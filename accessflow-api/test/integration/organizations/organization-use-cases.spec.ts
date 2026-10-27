import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { PrismaTransactionManager } from '@/shared/infrastructure/database/prisma-transaction-manager';
import { RoleSystemKey } from '@/modules/organizations/domain/entities/role.entity';
import { OrganizationPermissionDeniedError } from '@/modules/organizations/domain/errors/organization-permission-denied.error';
import { OrganizationPermission } from '@/modules/organizations/policies/organization-permission';
import { OrganizationAccessService } from '@/modules/organizations/application/services/organization-access.service';
import { CreateOrganizationUseCase } from '@/modules/organizations/application/use-cases/create-organization.use-case';
import { InviteMemberUseCase } from '@/modules/organizations/application/use-cases/invite-member.use-case';
import { AcceptInvitationUseCase } from '@/modules/organizations/application/use-cases/accept-invitation.use-case';
import { RevokeInvitationUseCase } from '@/modules/organizations/application/use-cases/revoke-invitation.use-case';
import { InvitationNotFoundError } from '@/modules/organizations/domain/errors/invitation-not-found.error';
import { CreateRoleUseCase } from '@/modules/organizations/application/use-cases/create-role.use-case';
import { UpdateRoleUseCase } from '@/modules/organizations/application/use-cases/update-role.use-case';
import { DeleteRoleUseCase } from '@/modules/organizations/application/use-cases/delete-role.use-case';
import { AssignRoleUseCase } from '@/modules/organizations/application/use-cases/assign-role.use-case';
import { RoleNameTakenError } from '@/modules/organizations/domain/errors/role-name-taken.error';
import { RoleInUseError } from '@/modules/organizations/domain/errors/role-in-use.error';
import { RoleNotFoundError } from '@/modules/organizations/domain/errors/role-not-found.error';
import { PrismaOrganizationRepository } from '@/modules/organizations/infrastructure/persistence/prisma-organization.repository';
import { PrismaMembershipRepository } from '@/modules/organizations/infrastructure/persistence/prisma-membership.repository';
import { PrismaRoleRepository } from '@/modules/organizations/infrastructure/persistence/prisma-role.repository';
import { PrismaInvitationRepository } from '@/modules/organizations/infrastructure/persistence/prisma-invitation.repository';
import { FakeUserDirectory } from '@test/fakes/organizations/fake-user-directory';
import { FixedClock } from '@test/fakes/shared/fixed-clock';
import {
  SeededOrganization,
  seedMembership,
  seedOrganization,
  seedRole,
} from '@test/factory/organizations/seed-organization';

let prisma: PrismaService;
let users: FakeUserDirectory;
let organizations: PrismaOrganizationRepository;
let createOrganization: CreateOrganizationUseCase;
let inviteMember: InviteMemberUseCase;
let acceptInvitation: AcceptInvitationUseCase;
let revokeInvitation: RevokeInvitationUseCase;
let createRole: CreateRoleUseCase;
let updateRole: UpdateRoleUseCase;
let deleteRole: DeleteRoleUseCase;
let assignRole: AssignRoleUseCase;

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
async function warmPool(connections = 4) {
  await Promise.all(
    Array.from({ length: connections }, () => prisma.$queryRaw`SELECT 1`),
  );
}

/** Como Promise.allSettled de uma promessa só: trata a rejeição na hora. */
function settle<T>(promise: Promise<T>): Promise<PromiseSettledResult<T>> {
  return Promise.allSettled([promise]).then(([result]) => result);
}

function reasonOf(result: PromiseSettledResult<unknown>): unknown {
  return result.status === 'rejected' ? result.reason : undefined;
}

/** Memberships ACTIVE e convites PENDING que apontam para papel apagado. */
async function usagesOfDeletedRoles(): Promise<number> {
  const [{ count }] = await prisma.$queryRaw<{ count: number }[]>`
    SELECT (
      (SELECT count(*) FROM memberships m JOIN roles r ON r.id = m.role_id
        WHERE m.status = 'ACTIVE' AND r.deleted_at IS NOT NULL)
      + (SELECT count(*) FROM invitations i JOIN roles r ON r.id = i.role_id
        WHERE i.status = 'PENDING' AND r.deleted_at IS NOT NULL)
    )::int AS count`;
  return count;
}

async function lockWaiters(): Promise<number> {
  const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
    SELECT count(*)::int AS waiting FROM pg_stat_activity
    WHERE datname = current_database() AND wait_event_type = 'Lock'`;
  return waiting;
}

/** Espera até `count` sessões deste banco estarem bloqueadas numa trava. */
async function waitForLockWaiters(count = 1, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'`;
    if (waiting >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Menos de ${count} sessão(ões) esperando trava a tempo.`);
}

describe('Casos de uso de organizations com Prisma (integração)', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const clients = new PrismaClientProvider(prisma);
    const transactions = new PrismaTransactionManager(prisma, clients);
    organizations = new PrismaOrganizationRepository(clients);
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
    acceptInvitation = new AcceptInvitationUseCase(
      invitations,
      organizations,
      roles,
      users,
      transactions,
      clock,
    );
    revokeInvitation = new RevokeInvitationUseCase(
      organizations,
      invitations,
      users,
      access,
      transactions,
      clock,
    );
    createRole = new CreateRoleUseCase(
      organizations,
      roles,
      users,
      access,
      transactions,
      clock,
    );
    updateRole = new UpdateRoleUseCase(
      organizations,
      roles,
      memberships,
      users,
      access,
      transactions,
      clock,
    );
    deleteRole = new DeleteRoleUseCase(
      organizations,
      roles,
      users,
      access,
      transactions,
      clock,
    );
    assignRole = new AssignRoleUseCase(
      organizations,
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
        await waitForLockWaiters();

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

  describe('acceptInvitation: só o destinatário trava a organização', () => {
    let acme: SeededOrganization;
    let invitationId: string;

    beforeEach(async () => {
      const ana = await createUser('sub-ana');
      await createUser('sub-bruno');
      await createUser('sub-carla');
      acme = await seedOrganization(prisma, { slug: 'acme', owner: ana.id });
      ({ id: invitationId } = await prisma.invitation.create({
        data: {
          organizationId: acme.id,
          email: 'sub-carla@example.com',
          roleId: acme.roleIds.MEMBER,
          invitedByUserId: ana.id,
          expiresAt: new Date('2026-03-08T12:00:00.000Z'),
        },
      }));
      await warmPool();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    /** O aceite, ou 'bloqueou' se ele não responder a tempo. */
    function acceptWithin(cognitoSub: string, id: string, ms = 1000) {
      return Promise.race([
        settle(acceptInvitation.execute({ cognitoSub, invitationId: id })),
        new Promise<'bloqueou'>((resolve) =>
          setTimeout(() => resolve('bloqueou'), ms),
        ),
      ]);
    }

    it('não destinatário, convite inexistente ou id malformado: NOT_FOUND sem travar a organização', async () => {
      const lock = vi.spyOn(organizations, 'lock');

      // T0 segura a trava da organização: quem tentasse travá-la esperaria.
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${acme.id}::uuid FOR UPDATE`;

        for (const [cognitoSub, id] of [
          ['sub-bruno', invitationId],
          ['sub-carla', crypto.randomUUID()],
          ['sub-carla', 'nao-e-uuid'],
        ]) {
          const outcome = await acceptWithin(cognitoSub, id);
          expect(outcome).not.toBe('bloqueou');
          expect(
            reasonOf(outcome as PromiseSettledResult<unknown>),
          ).toBeInstanceOf(InvitationNotFoundError);
        }
        expect(await lockWaiters()).toBe(0);
      });

      expect(lock).not.toHaveBeenCalled();
      expect(
        (
          await prisma.invitation.findUniqueOrThrow({
            where: { id: invitationId },
          })
        ).status,
      ).toBe('PENDING');
    });

    it('controle: o aceite do destinatário espera a trava da organização', async () => {
      let accepted!: Promise<PromiseSettledResult<unknown>>;

      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${acme.id}::uuid FOR UPDATE`;
        accepted = settle(
          acceptInvitation.execute({ cognitoSub: 'sub-carla', invitationId }),
        );
        await waitForLockWaiters(1);
      });

      expect((await accepted).status).toBe('fulfilled');
    });
  });

  describe('convite PENDING expirado prende o papel até ser revogado', () => {
    it('deleteRole recusa com ROLE_IN_USE; revokeInvitation libera; deleteRole passa', async () => {
      const ana = await createUser('sub-ana');
      const acme = await seedOrganization(prisma, {
        slug: 'acme',
        owner: ana.id,
      });
      const roleId = await seedRole(prisma, {
        organizationId: acme.id,
        name: 'Financeiro',
      });
      // Expirado em relação ao relógio dos casos de uso (2026-03-01).
      const invitation = await prisma.invitation.create({
        data: {
          organizationId: acme.id,
          email: 'bruno@example.com',
          roleId,
          invitedByUserId: ana.id,
          expiresAt: new Date('2026-02-20T12:00:00.000Z'),
        },
      });
      const remove = () =>
        deleteRole.execute({
          cognitoSub: 'sub-ana',
          organizationId: acme.id,
          roleId,
        });

      await expect(remove()).rejects.toBeInstanceOf(RoleInUseError);

      await revokeInvitation.execute({
        cognitoSub: 'sub-ana',
        organizationId: acme.id,
        invitationId: invitation.id,
      });
      expect(
        (
          await prisma.invitation.findUniqueOrThrow({
            where: { id: invitation.id },
          })
        ).status,
      ).toBe('REVOKED');

      await expect(remove()).resolves.toBeUndefined();
      expect(
        (await prisma.role.findUniqueOrThrow({ where: { id: roleId } }))
          .deletedAt,
      ).not.toBeNull();
    });
  });

  describe('updateRole com Prisma', () => {
    it('renomear "gerente" para "Gerente" é aceito: o próprio papel não colide', async () => {
      const ana = await createUser('sub-ana');
      const acme = await seedOrganization(prisma, {
        slug: 'acme',
        owner: ana.id,
      });
      const roleId = await seedRole(prisma, {
        organizationId: acme.id,
        name: 'gerente',
      });
      const rename = (name: string) =>
        updateRole.execute({
          cognitoSub: 'sub-ana',
          organizationId: acme.id,
          roleId,
          name,
        });

      await expect(rename('Gerente')).resolves.toMatchObject({
        role: { name: 'Gerente' },
      });
      expect(
        (await prisma.role.findUniqueOrThrow({ where: { id: roleId } })).name,
      ).toBe('Gerente');

      // Controle: o nome de outro papel continua colidindo.
      await expect(rename('member')).rejects.toBeInstanceOf(RoleNameTakenError);
    });
  });

  /**
   * Provas de concorrência dos papéis. Uma transação de teste (T0) segura
   * uma trava para forçar a intercalação perigosa: as duas operações fazem as
   * leituras e só então esbarram em T0. Com a trava da organização no caso
   * de uso, a segunda espera a primeira terminar e lê o estado novo.
   */
  describe('provas de concorrência dos papéis', () => {
    let ana: { id: string };
    let bruno: { id: string };
    let carla: { id: string };
    let acme: SeededOrganization;

    beforeEach(async () => {
      ana = await createUser('sub-ana');
      bruno = await createUser('sub-bruno');
      carla = await createUser('sub-carla');
      acme = await seedOrganization(prisma, { slug: 'acme', owner: ana.id });
      await warmPool(8);
    });

    function lockOrganization(tx: Prisma.TransactionClient) {
      return tx.$queryRaw`SELECT id FROM organizations WHERE id = ${acme.id}::uuid FOR UPDATE`;
    }

    async function membershipOf(userId: string) {
      return prisma.membership.findFirst({
        where: { organizationId: acme.id, userId },
        include: { role: true },
      });
    }

    it('prova A: deleteRole × acceptInvitation de convite PENDING com o papel', async () => {
      const finance = await seedRole(prisma, {
        organizationId: acme.id,
        name: 'Financeiro',
      });
      const invitation = await prisma.invitation.create({
        data: {
          organizationId: acme.id,
          email: 'sub-carla@example.com',
          roleId: finance,
          invitedByUserId: ana.id,
          expiresAt: new Date('2026-03-08T12:00:00.000Z'),
        },
      });
      let deleted!: Promise<PromiseSettledResult<void>>;
      let accepted!: Promise<PromiseSettledResult<unknown>>;

      await prisma.$transaction(async (tx) => {
        await lockOrganization(tx);
        deleted = settle(
          deleteRole.execute({
            cognitoSub: 'sub-ana',
            organizationId: acme.id,
            roleId: finance,
          }),
        );
        await waitForLockWaiters(1);
        accepted = settle(
          acceptInvitation.execute({
            cognitoSub: 'sub-carla',
            invitationId: invitation.id,
          }),
        );
        await waitForLockWaiters(2);
      });

      expect(reasonOf(await deleted)).toBeInstanceOf(RoleInUseError);
      expect((await accepted).status).toBe('fulfilled');
      expect((await membershipOf(carla.id))?.roleId).toBe(finance);
      expect(await usagesOfDeletedRoles()).toBe(0);
    });

    it('prova B: deleteRole × assignRole para o papel', async () => {
      const finance = await seedRole(prisma, {
        organizationId: acme.id,
        name: 'Financeiro',
      });
      const target = await seedMembership(prisma, {
        organizationId: acme.id,
        userId: bruno.id,
      });
      let deleted!: Promise<PromiseSettledResult<void>>;
      let assigned!: Promise<PromiseSettledResult<unknown>>;

      // T0 trava as linhas que as duas escritas alteram: as duas leem antes.
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM roles WHERE id = ${finance}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM memberships WHERE id = ${target.id}::uuid FOR UPDATE`;
        deleted = settle(
          deleteRole.execute({
            cognitoSub: 'sub-ana',
            organizationId: acme.id,
            roleId: finance,
          }),
        );
        assigned = settle(
          assignRole.execute({
            cognitoSub: 'sub-ana',
            organizationId: acme.id,
            userId: bruno.id,
            roleId: finance,
          }),
        );
        await waitForLockWaiters(2);
      });

      const results = [await deleted, await assigned];
      // A invariante primeiro: sem a trava, o Bruno fica com papel apagado.
      expect(await usagesOfDeletedRoles()).toBe(0);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const [failure] = results.map(reasonOf).filter(Boolean);
      expect(
        failure instanceof RoleInUseError ||
          failure instanceof RoleNotFoundError,
      ).toBe(true);
    });

    it('prova C: dois createRole com o mesmo nome', async () => {
      const create = (name: string) =>
        settle(
          createRole.execute({
            cognitoSub: 'sub-ana',
            organizationId: acme.id,
            name,
            permissions: [],
          }),
        );
      let first!: Promise<PromiseSettledResult<unknown>>;
      let second!: Promise<PromiseSettledResult<unknown>>;

      await prisma.$transaction(async (tx) => {
        await lockOrganization(tx);
        first = create('Financeiro');
        second = create('financeiro');
        await waitForLockWaiters(2);
      });

      const results = [await first, await second];
      // A invariante primeiro: sem a trava, ficam dois papéis com o nome.
      const [{ count }] = await prisma.$queryRaw<{ count: number }[]>`
        SELECT count(*)::int AS count FROM roles
        WHERE organization_id = ${acme.id}::uuid AND lower(name) = 'financeiro'
          AND deleted_at IS NULL`;
      expect(count).toBe(1);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.map(reasonOf).filter(Boolean)).toEqual([
        expect.any(RoleNameTakenError),
      ]);
    });

    it('prova D: dois OWNERs rebaixando um ao outro', async () => {
      const brunoOwner = await seedMembership(prisma, {
        organizationId: acme.id,
        userId: bruno.id,
        role: RoleSystemKey.OWNER,
      });
      const anaOwner = await membershipOf(ana.id);
      const demote = (cognitoSub: string, userId: string) =>
        settle(
          assignRole.execute({
            cognitoSub,
            organizationId: acme.id,
            userId,
            roleId: acme.roleIds.MEMBER,
          }),
        );
      let anaDemotesBruno!: Promise<PromiseSettledResult<unknown>>;
      let brunoDemotesAna!: Promise<PromiseSettledResult<unknown>>;

      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM memberships WHERE id IN (${anaOwner!.id}::uuid, ${brunoOwner.id}::uuid) FOR UPDATE`;
        anaDemotesBruno = demote('sub-ana', bruno.id);
        brunoDemotesAna = demote('sub-bruno', ana.id);
        await waitForLockWaiters(2);
      });

      const results = [await anaDemotesBruno, await brunoDemotesAna];
      // A invariante primeiro: sem a trava, a organização fica sem OWNER.
      expect(
        await prisma.membership.count({
          where: {
            organizationId: acme.id,
            status: 'ACTIVE',
            role: { systemKey: 'OWNER' },
          },
        }),
      ).toBe(1);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      // Quem perdeu a corrida já não é OWNER: perdeu também roles:assign.
      expect(results.map(reasonOf).filter(Boolean)).toEqual([
        expect.any(OrganizationPermissionDeniedError),
      ]);
    });

    it('prova E: updateRole tira roles:assign × assignRole de quem tem o papel', async () => {
      const manager = await seedRole(prisma, {
        organizationId: acme.id,
        name: 'Gestor',
        permissions: [
          OrganizationPermission.ROLES_ASSIGN,
          OrganizationPermission.MEMBERS_READ,
        ],
      });
      const reader = await seedRole(prisma, {
        organizationId: acme.id,
        name: 'Leitor',
        permissions: [OrganizationPermission.MEMBERS_READ],
      });
      await seedMembership(prisma, {
        organizationId: acme.id,
        userId: bruno.id,
        roleId: manager,
      });
      await seedMembership(prisma, {
        organizationId: acme.id,
        userId: carla.id,
      });
      let updated!: Promise<PromiseSettledResult<unknown>>;
      let assigned!: Promise<PromiseSettledResult<unknown>>;

      await prisma.$transaction(async (tx) => {
        await lockOrganization(tx);
        // A edição chega primeiro à fila da trava da organização.
        updated = settle(
          updateRole.execute({
            cognitoSub: 'sub-ana',
            organizationId: acme.id,
            roleId: manager,
            permissions: [OrganizationPermission.MEMBERS_READ],
          }),
        );
        await waitForLockWaiters(1);
        assigned = settle(
          assignRole.execute({
            cognitoSub: 'sub-bruno',
            organizationId: acme.id,
            userId: carla.id,
            roleId: reader,
          }),
        );
        await waitForLockWaiters(2);
      });

      expect((await updated).status).toBe('fulfilled');
      expect(reasonOf(await assigned)).toBeInstanceOf(
        OrganizationPermissionDeniedError,
      );
      expect((await membershipOf(carla.id))?.roleId).toBe(acme.roleIds.MEMBER);
    });

    it('prova F extra: reconvite × acceptInvitation sem deadlock', async () => {
      const invitation = await prisma.invitation.create({
        data: {
          organizationId: acme.id,
          email: 'sub-carla@example.com',
          roleId: acme.roleIds.MEMBER,
          invitedByUserId: ana.id,
          expiresAt: new Date('2026-03-08T12:00:00.000Z'),
        },
      });
      let reinvited!: Promise<PromiseSettledResult<unknown>>;
      let accepted!: Promise<PromiseSettledResult<unknown>>;

      await prisma.$transaction(async (tx) => {
        await lockOrganization(tx);
        // O reconvite chega primeiro: trava a organização e depois o convite.
        reinvited = settle(
          inviteMember.execute({
            cognitoSub: 'sub-ana',
            organizationId: acme.id,
            email: 'sub-carla@example.com',
            role: RoleSystemKey.OWNER,
          }),
        );
        await waitForLockWaiters(1);
        accepted = settle(
          acceptInvitation.execute({
            cognitoSub: 'sub-carla',
            invitationId: invitation.id,
          }),
        );
        await waitForLockWaiters(2);
      });

      expect(reasonOf(await reinvited)).toBeUndefined();
      expect(reasonOf(await accepted)).toBeUndefined();
      // O aceite releu o convite depois da trava: vale o papel do reconvite.
      expect((await membershipOf(carla.id))?.role.systemKey).toBe('OWNER');
    });
  });
});
