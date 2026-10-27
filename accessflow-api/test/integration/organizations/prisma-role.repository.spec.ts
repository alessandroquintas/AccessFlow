import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { PrismaTransactionManager } from '@/shared/infrastructure/database/prisma-transaction-manager';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { Invitation } from '@/modules/organizations/domain/entities/invitation.entity';
import {
  Role,
  RoleSystemKey,
} from '@/modules/organizations/domain/entities/role.entity';
import { PrismaRoleRepository } from '@/modules/organizations/infrastructure/persistence/prisma-role.repository';
import { PrismaOrganizationRepository } from '@/modules/organizations/infrastructure/persistence/prisma-organization.repository';
import { PrismaMembershipRepository } from '@/modules/organizations/infrastructure/persistence/prisma-membership.repository';
import { PrismaInvitationMapper } from '@/modules/organizations/infrastructure/persistence/mappers/prisma-invitation.mapper';
import { OrganizationPermission } from '@/modules/organizations/policies/organization-permission';
import {
  SeededOrganization,
  seedMembership,
  seedOrganization,
  seedRole,
} from '@test/factory/organizations/seed-organization';

const FOREIGN_KEY_VIOLATION = 'P2003';
const NOW = new Date('2026-03-01T12:00:00.000Z');
const LATER = new Date('2026-03-02T12:00:00.000Z');
const { MEMBERS_READ, MEMBERS_INVITE, MEMBERS_REMOVE, ROLES_READ } =
  OrganizationPermission;

let prisma: PrismaService;
let roles: PrismaRoleRepository;
let organizations: PrismaOrganizationRepository;
let memberships: PrismaMembershipRepository;

async function createUser(cognitoSub: string) {
  return prisma.user.create({
    data: { cognitoSub, name: 'Usuário', email: `${cognitoSub}@example.com` },
  });
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === FOREIGN_KEY_VIOLATION
  );
}

describe('PrismaRoleRepository (integração)', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const clients = new PrismaClientProvider(prisma);
    const transactions = new PrismaTransactionManager(prisma, clients);
    roles = new PrismaRoleRepository(clients, transactions);
    organizations = new PrismaOrganizationRepository(clients);
    memberships = new PrismaMembershipRepository(clients, transactions);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "memberships", "organizations", "users" CASCADE`;
  });

  describe('createDefaults e leituras', () => {
    let organization: Organization;
    let defaults: ReturnType<typeof Role.createDefaults>;

    beforeEach(async () => {
      organization = Organization.create({ name: 'Acme', slug: 'acme' });
      await organizations.create(organization);
      defaults = Role.createDefaults(organization.id, NOW);
      await roles.createDefaults(defaults);
    });

    it('grava os dois papéis; só o MEMBER tem linha de permissão', async () => {
      const records = await prisma.role.findMany({
        where: { organizationId: organization.id },
        include: { permissions: true },
        orderBy: { systemKey: 'asc' },
      });

      expect(
        records.map((r) => ({
          name: r.name,
          systemKey: r.systemKey,
          permissions: r.permissions.map((p) => p.permissionKey),
        })),
      ).toEqual([
        { name: 'Owner', systemKey: 'OWNER', permissions: [] },
        { name: 'Member', systemKey: 'MEMBER', permissions: ['members:read'] },
      ]);
    });

    it('findById e findSystemRole devolvem o papel com as permissões', async () => {
      const byId = await roles.findById(organization.id, defaults.member.id);
      const bySystemKey = await roles.findSystemRole(
        organization.id,
        RoleSystemKey.MEMBER,
      );

      for (const role of [byId, bySystemKey]) {
        expect(role).toMatchObject({
          id: defaults.member.id,
          organizationId: organization.id,
          systemKey: RoleSystemKey.MEMBER,
          permissions: ['members:read'],
          deletedAt: null,
          createdAt: NOW,
        });
      }
      expect(
        (await roles.findSystemRole(organization.id, RoleSystemKey.OWNER))?.id,
      ).toBe(defaults.owner.id);
    });

    it('findById ignora papel de outra organização e papel apagado', async () => {
      const beta = await seedOrganization(prisma, { slug: 'beta' });
      await prisma.role.update({
        where: { id: defaults.member.id },
        data: { deletedAt: NOW },
      });

      expect(
        await roles.findById(organization.id, beta.roleIds.MEMBER),
      ).toBeNull();
      expect(
        await roles.findById(organization.id, defaults.member.id),
      ).toBeNull();
      expect(
        await roles.findSystemRole(organization.id, RoleSystemKey.MEMBER),
      ).toBeNull();
    });

    it('findByIds inclui apagados e ignora ids inexistentes', async () => {
      await prisma.role.update({
        where: { id: defaults.member.id },
        data: { deletedAt: NOW },
      });

      const found = await roles.findByIds([
        defaults.owner.id,
        defaults.member.id,
        crypto.randomUUID(),
      ]);

      expect(found.map((r) => r.id).sort()).toEqual(
        [defaults.owner.id, defaults.member.id].sort(),
      );
      expect(found.find((r) => r.id === defaults.member.id)?.isDeleted()).toBe(
        true,
      );
    });
  });

  describe('FK composta (papel da mesma organização)', () => {
    let acme: SeededOrganization;
    let beta: SeededOrganization;
    let ana: { id: string };

    beforeEach(async () => {
      ana = await createUser('sub-ana');
      acme = await seedOrganization(prisma, { slug: 'acme' });
      beta = await seedOrganization(prisma, { slug: 'beta' });
    });

    it('recusa membership com papel de outra organização e não grava nada', async () => {
      const error = await memberships
        .create(
          Membership.create({
            organizationId: acme.id,
            userId: ana.id,
            roleId: beta.roleIds.MEMBER,
          }),
        )
        .catch((e: unknown) => e);

      expect(isForeignKeyViolation(error)).toBe(true);
      expect(await prisma.membership.count()).toBe(0);
    });

    it('recusa trocar o papel de um membership pelo de outra organização', async () => {
      const membership = Membership.create({
        organizationId: acme.id,
        userId: ana.id,
        roleId: acme.roleIds.MEMBER,
      });
      await memberships.create(membership);

      const error = await prisma.membership
        .update({
          where: { id: membership.id },
          data: { roleId: beta.roleIds.OWNER },
        })
        .catch((e: unknown) => e);

      expect(isForeignKeyViolation(error)).toBe(true);
      expect(
        (
          await prisma.membership.findUniqueOrThrow({
            where: { id: membership.id },
          })
        ).roleId,
      ).toBe(acme.roleIds.MEMBER);
    });

    it('recusa convite com papel de outra organização', async () => {
      const invitation = Invitation.create(
        {
          organizationId: acme.id,
          email: 'bruno@example.com',
          roleId: beta.roleIds.MEMBER,
          invitedByUserId: ana.id,
        },
        NOW,
      );

      const error = await prisma.invitation
        .create({ data: PrismaInvitationMapper.toPersistence(invitation) })
        .catch((e: unknown) => e);

      expect(isForeignKeyViolation(error)).toBe(true);
      expect(await prisma.invitation.count()).toBe(0);
    });

    it('controle: com o papel da própria organização, grava', async () => {
      await memberships.create(
        Membership.create({
          organizationId: acme.id,
          userId: ana.id,
          roleId: acme.roleIds.MEMBER,
        }),
      );

      expect(await prisma.membership.count()).toBe(1);
    });
  });

  describe('papéis customizados', () => {
    let acme: SeededOrganization;
    let beta: SeededOrganization;
    let ana: { id: string };

    beforeEach(async () => {
      ana = await createUser('sub-ana');
      acme = await seedOrganization(prisma, { slug: 'acme', owner: ana.id });
      beta = await seedOrganization(prisma, { slug: 'beta' });
    });

    function custom(name: string, permissions: string[]): Role {
      return Role.create({ organizationId: acme.id, name, permissions }, NOW);
    }

    async function permissionRows(roleId: string) {
      const rows = await prisma.rolePermission.findMany({
        where: { roleId },
        orderBy: { permissionKey: 'asc' },
      });
      return rows.map((row) => row.permissionKey);
    }

    it('create grava o papel e as permissões juntos', async () => {
      const finance = custom('Financeiro', [MEMBERS_READ, ROLES_READ]);

      await roles.create(finance);

      expect(
        await prisma.role.findUnique({ where: { id: finance.id } }),
      ).toMatchObject({
        organizationId: acme.id,
        name: 'Financeiro',
        systemKey: null,
        deletedAt: null,
        createdAt: NOW,
      });
      expect(await permissionRows(finance.id)).toEqual([
        MEMBERS_READ,
        ROLES_READ,
      ]);
      expect((await roles.findById(acme.id, finance.id))?.permissions).toEqual([
        MEMBERS_READ,
        ROLES_READ,
      ]);
    });

    it('create sem permissões não grava linha em role_permissions', async () => {
      const empty = custom('Vazio', []);

      await roles.create(empty);

      expect(await permissionRows(empty.id)).toEqual([]);
    });

    it('listActiveByOrganization traz os não apagados da organização, com permissões', async () => {
      const finance = custom('Financeiro', [MEMBERS_READ]);
      await roles.create(finance);
      await seedRole(prisma, {
        organizationId: acme.id,
        name: 'Antigo',
        deletedAt: NOW,
      });
      await seedRole(prisma, { organizationId: beta.id, name: 'De fora' });

      const listed = await roles.listActiveByOrganization(acme.id);

      expect(listed.map((role) => role.id).sort()).toEqual(
        [acme.roleIds.OWNER, acme.roleIds.MEMBER, finance.id].sort(),
      );
      expect(
        listed.find((role) => role.id === finance.id)?.permissions,
      ).toEqual([MEMBERS_READ]);
    });

    it('save grava o nome e só a diferença das permissões, sem tocar em outros papéis', async () => {
      const finance = custom('Financeiro', [MEMBERS_READ, MEMBERS_INVITE]);
      await roles.create(finance);
      const kept = await prisma.rolePermission.findUniqueOrThrow({
        where: {
          roleId_permissionKey: {
            roleId: finance.id,
            permissionKey: MEMBERS_INVITE,
          },
        },
      });

      finance.rename('Contas a Pagar', LATER);
      finance.setPermissions([MEMBERS_INVITE, ROLES_READ], LATER);
      await roles.save(finance);

      expect(
        await prisma.role.findUniqueOrThrow({ where: { id: finance.id } }),
      ).toMatchObject({ name: 'Contas a Pagar', updatedAt: LATER });
      expect(await permissionRows(finance.id)).toEqual([
        MEMBERS_INVITE,
        ROLES_READ,
      ]);
      // A linha mantida não foi apagada e recriada.
      expect(
        await prisma.rolePermission.findUnique({
          where: {
            roleId_permissionKey: {
              roleId: finance.id,
              permissionKey: MEMBERS_INVITE,
            },
          },
        }),
      ).toEqual(kept);
      expect(await permissionRows(acme.roleIds.MEMBER)).toEqual([MEMBERS_READ]);
    });

    it('save com conjunto vazio apaga todas as permissões do papel', async () => {
      const finance = custom('Financeiro', [MEMBERS_READ, MEMBERS_REMOVE]);
      await roles.create(finance);

      finance.setPermissions([], LATER);
      await roles.save(finance);

      expect(await permissionRows(finance.id)).toEqual([]);
    });

    it('save grava o deletedAt: some de findById e da listagem, segue em findByIds', async () => {
      const finance = custom('Financeiro', [MEMBERS_READ]);
      await roles.create(finance);

      finance.softDelete(LATER);
      await roles.save(finance);

      expect(await roles.findById(acme.id, finance.id)).toBeNull();
      expect(
        (await roles.listActiveByOrganization(acme.id)).map((r) => r.id),
      ).not.toContain(finance.id);
      const [found] = await roles.findByIds([finance.id]);
      expect(found.deletedAt).toEqual(LATER);
      // A linha e as permissões ficam: o papel só é marcado como apagado.
      expect(await permissionRows(finance.id)).toEqual([MEMBERS_READ]);
    });

    describe('isInUse', () => {
      let roleId: string;
      let bruno: { id: string };

      beforeEach(async () => {
        roleId = await seedRole(prisma, {
          organizationId: acme.id,
          name: 'Financeiro',
        });
        bruno = await createUser('sub-bruno');
      });

      async function invite(
        status: 'PENDING' | 'ACCEPTED' | 'REVOKED',
        expiresAt = LATER,
      ) {
        await prisma.invitation.create({
          data: {
            organizationId: acme.id,
            email: `${status.toLowerCase()}@example.com`,
            roleId,
            status,
            invitedByUserId: ana.id,
            expiresAt,
          },
        });
      }

      it('sem uso: false (id inexistente também)', async () => {
        expect(await roles.isInUse(roleId)).toBe(false);
        expect(await roles.isInUse(crypto.randomUUID())).toBe(false);
      });

      it('membership ACTIVE: true; REMOVED não conta', async () => {
        await seedMembership(prisma, {
          organizationId: acme.id,
          userId: bruno.id,
          roleId,
          status: 'REMOVED',
        });
        expect(await roles.isInUse(roleId)).toBe(false);

        await prisma.membership.updateMany({
          where: { userId: bruno.id },
          data: { status: 'ACTIVE' },
        });
        expect(await roles.isInUse(roleId)).toBe(true);
      });

      it('convite PENDING, mesmo expirado: true; respondidos não contam', async () => {
        await invite('ACCEPTED');
        await invite('REVOKED');
        expect(await roles.isInUse(roleId)).toBe(false);

        await invite('PENDING', new Date('2020-01-01T00:00:00.000Z'));
        expect(await roles.isInUse(roleId)).toBe(true);
      });

      it('uso por outro papel não conta', async () => {
        await seedMembership(prisma, {
          organizationId: acme.id,
          userId: bruno.id,
        });

        expect(await roles.isInUse(roleId)).toBe(false);
        expect(await roles.isInUse(acme.roleIds.MEMBER)).toBe(true);
      });
    });
  });
});
