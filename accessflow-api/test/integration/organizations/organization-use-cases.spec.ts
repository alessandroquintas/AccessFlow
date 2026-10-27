import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { PrismaTransactionManager } from '@/shared/infrastructure/database/prisma-transaction-manager';
import { RoleSystemKey } from '@/modules/organizations/domain/entities/role.entity';
import { OrganizationPermissionDeniedError } from '@/modules/organizations/domain/errors/organization-permission-denied.error';
import { OrganizationPermission } from '@/modules/organizations/policies/organization-permission';
import { OrganizationAccessService } from '@/modules/organizations/application/services/organization-access.service';
import { CreateOrganizationUseCase } from '@/modules/organizations/application/use-cases/create-organization.use-case';
import { InviteMemberUseCase } from '@/modules/organizations/application/use-cases/invite-member.use-case';
import { PrismaOrganizationRepository } from '@/modules/organizations/infrastructure/persistence/prisma-organization.repository';
import { PrismaMembershipRepository } from '@/modules/organizations/infrastructure/persistence/prisma-membership.repository';
import { PrismaRoleRepository } from '@/modules/organizations/infrastructure/persistence/prisma-role.repository';
import { PrismaInvitationRepository } from '@/modules/organizations/infrastructure/persistence/prisma-invitation.repository';
import { FakeUserDirectory } from '@test/fakes/organizations/fake-user-directory';
import { FixedClock } from '@test/fakes/shared/fixed-clock';
import {
  SeededOrganization,
  seedOrganization,
} from '@test/factory/organizations/seed-organization';

let prisma: PrismaService;
let users: FakeUserDirectory;
let createOrganization: CreateOrganizationUseCase;
let inviteMember: InviteMemberUseCase;

async function createUser(cognitoSub: string) {
  const user = await prisma.user.create({
    data: { cognitoSub, name: 'Usuário', email: `${cognitoSub}@example.com` },
  });
  users.register(cognitoSub, user.id);
  return user;
}

/**
 * Abre conexões no pool antes da corrida. Sem isso, a transação do caso de
 * uso espera uma conexão nova e pode só começar depois da concorrente.
 */
async function warmPool() {
  await Promise.all(
    Array.from({ length: 4 }, () => prisma.$queryRaw`SELECT 1`),
  );
}

/** Espera até alguma sessão deste banco estar bloqueada esperando trava. */
async function waitForLockWaiter(timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'`;
    if (waiting > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Nenhuma sessão ficou esperando a trava a tempo.');
}

describe('Casos de uso de organizations com Prisma (integração)', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const clients = new PrismaClientProvider(prisma);
    const transactions = new PrismaTransactionManager(prisma, clients);
    const organizations = new PrismaOrganizationRepository(clients);
    const memberships = new PrismaMembershipRepository(clients, transactions);
    const roles = new PrismaRoleRepository(clients, transactions);
    const invitations = new PrismaInvitationRepository(clients, transactions);
    const clock = new FixedClock(new Date('2026-03-01T12:00:00.000Z'));
    users = new FakeUserDirectory();
    const access = new OrganizationAccessService(
      organizations,
      memberships,
      roles,
    );

    createOrganization = new CreateOrganizationUseCase(
      organizations,
      roles,
      memberships,
      users,
      transactions,
      clock,
    );
    inviteMember = new InviteMemberUseCase(
      organizations,
      invitations,
      memberships,
      roles,
      users,
      access,
      transactions,
      clock,
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "memberships", "organizations", "users" CASCADE`;
  });

  describe('createOrganization', () => {
    it('cria exatamente dois papéis, o MEMBER só com members:read, e o criador como OWNER', async () => {
      const ana = await createUser('sub-ana');

      const { organization } = await createOrganization.execute({
        cognitoSub: 'sub-ana',
        name: 'Acme',
        slug: 'acme',
      });

      const roles = await prisma.role.findMany({
        include: { permissions: true },
        orderBy: { systemKey: 'asc' },
      });
      expect(
        roles.map((r) => ({
          organizationId: r.organizationId,
          name: r.name,
          systemKey: r.systemKey,
          deletedAt: r.deletedAt,
          permissions: r.permissions.map((p) => p.permissionKey),
        })),
      ).toEqual([
        {
          organizationId: organization.id,
          name: 'Owner',
          systemKey: 'OWNER',
          deletedAt: null,
          permissions: [],
        },
        {
          organizationId: organization.id,
          name: 'Member',
          systemKey: 'MEMBER',
          deletedAt: null,
          permissions: ['members:read'],
        },
      ]);

      const membership = await prisma.membership.findFirstOrThrow({
        where: { userId: ana.id },
        include: { role: true },
      });
      expect(membership.role.systemKey).toBe('OWNER');
    });

    it('se o membership falhar, a organização e os papéis também são desfeitos', async () => {
      // Perfil conhecido pelo diretório, sem linha em users: a FK do
      // membership falha depois da organização e dos papéis.
      users.register('sub-sem-usuario', crypto.randomUUID());

      await expect(
        createOrganization.execute({
          cognitoSub: 'sub-sem-usuario',
          name: 'Acme',
          slug: 'acme',
        }),
      ).rejects.toThrow();

      expect(await prisma.organization.count()).toBe(0);
      expect(await prisma.role.count()).toBe(0);
      expect(await prisma.rolePermission.count()).toBe(0);
    });
  });

  describe('inviteMember: permissão checada dentro da transação', () => {
    let acme: SeededOrganization;

    beforeEach(async () => {
      const ana = await createUser('sub-ana');
      const bruno = await createUser('sub-bruno');
      acme = await seedOrganization(prisma, {
        slug: 'acme',
        owner: ana.id,
        members: [{ userId: bruno.id }],
      });
      // O MEMBER (papel do Bruno) pode convidar.
      await prisma.rolePermission.create({
        data: {
          roleId: acme.roleIds.MEMBER,
          permissionKey: OrganizationPermission.MEMBERS_INVITE,
        },
      });
    });

    function brunoInvites(email: string) {
      return inviteMember.execute({
        cognitoSub: 'sub-bruno',
        organizationId: acme.id,
        email,
        role: RoleSystemKey.MEMBER,
      });
    }

    it('controle: sem escrita concorrente, o MEMBER com members:invite convida', async () => {
      const { invitation } = await brunoInvites('carla@example.com');

      expect(invitation.roleId).toBe(acme.roleIds.MEMBER);
      expect(await prisma.invitation.count()).toBe(1);
    });

    it('o papel perde members:invite numa escrita concorrente que trava a organização: nada é gravado', async () => {
      await warmPool();
      let outcome!: Promise<unknown>;

      // Escrita concorrente: trava a organização, espera o convite ficar
      // bloqueado nela e só então tira a permissão. Usa o Prisma direto: um
      // TransactionManager.run aqui faria o convite entrar nesta transação.
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${acme.id}::uuid FOR UPDATE`;

        outcome = brunoInvites('carla@example.com').catch(
          (error: unknown) => error,
        );
        await waitForLockWaiter();

        await tx.rolePermission.delete({
          where: {
            roleId_permissionKey: {
              roleId: acme.roleIds.MEMBER,
              permissionKey: OrganizationPermission.MEMBERS_INVITE,
            },
          },
        });
      });

      // Checada antes da trava, a permissão ainda existiria e o convite
      // seria gravado depois que a escrita concorrente terminasse.
      expect(await outcome).toBeInstanceOf(OrganizationPermissionDeniedError);
      expect(await prisma.invitation.count()).toBe(0);
    });
  });
});
