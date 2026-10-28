import { beforeEach, describe, expect, it } from 'vitest';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import {
  Role,
  RoleSystemKey,
} from '@/modules/organizations/domain/entities/role.entity';
import { CustomPermission } from '@/modules/organizations/domain/entities/custom-permission.entity';
import {
  OrganizationPermission,
  PERMISSION_CATALOG,
  PermissionCatalog,
} from '@/modules/organizations/policies/organization-permission';
import { OrganizationAccessService } from '@/modules/organizations/application/services/organization-access.service';
import { ListOrganizationPermissionsUseCase } from '@/modules/organizations/application/use-cases/list-organization-permissions.use-case';
import { CreatePermissionUseCase } from '@/modules/organizations/application/use-cases/create-permission.use-case';
import { UpdatePermissionUseCase } from '@/modules/organizations/application/use-cases/update-permission.use-case';
import { DeletePermissionUseCase } from '@/modules/organizations/application/use-cases/delete-permission.use-case';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { OrganizationPermissionDeniedError } from '@/modules/organizations/domain/errors/organization-permission-denied.error';
import { InvalidPermissionKeyError } from '@/modules/organizations/domain/errors/invalid-permission-key.error';
import { InvalidPermissionDescriptionError } from '@/modules/organizations/domain/errors/invalid-permission-description.error';
import { ReservedPermissionResourceError } from '@/modules/organizations/domain/errors/reserved-permission-resource.error';
import { PermissionKeyTakenError } from '@/modules/organizations/domain/errors/permission-key-taken.error';
import { PermissionLimitReachedError } from '@/modules/organizations/domain/errors/permission-limit-reached.error';
import { PermissionInUseError } from '@/modules/organizations/domain/errors/permission-in-use.error';
import { PermissionNotFoundError } from '@/modules/organizations/domain/errors/permission-not-found.error';
import { InMemoryOrganizationRepository } from '@test/in-memory/organizations/in-memory-organization-repository';
import { InMemoryMembershipRepository } from '@test/in-memory/organizations/in-memory-membership-repository';
import { InMemoryRoleRepository } from '@test/in-memory/organizations/in-memory-role-repository';
import { InMemoryCustomPermissionRepository } from '@test/in-memory/organizations/in-memory-custom-permission-repository';
import { FakeUserDirectory } from '@test/fakes/organizations/fake-user-directory';
import { FakeTransactionManager } from '@test/fakes/shared/fake-transaction-manager';
import { FixedClock } from '@test/fakes/shared/fixed-clock';

const START = new Date('2026-03-01T12:00:00.000Z');
const LATER = new Date('2026-03-02T12:00:00.000Z');
const { MEMBERS_READ, ROLES_READ, PERMISSIONS_MANAGE } = OrganizationPermission;

const OWNER = { sub: 'sub-owner', id: '11111111-1111-4111-8111-111111111111' };
const MEMBER = {
  sub: 'sub-member',
  id: '22222222-2222-4222-8222-222222222222',
};
const OUTSIDER = {
  sub: 'sub-outsider',
  id: '44444444-4444-4444-8444-444444444444',
};

let roles: InMemoryRoleRepository;
let memberships: InMemoryMembershipRepository;
let organizations: InMemoryOrganizationRepository;
let customPermissions: InMemoryCustomPermissionRepository;
let listPermissions: ListOrganizationPermissionsUseCase;
let createPermission: CreatePermissionUseCase;
let updatePermission: UpdatePermissionUseCase;
let deletePermission: DeletePermissionUseCase;
let acme: Organization;
let memberRole: Role;

function createOrganization(slug: string): Organization {
  const organization = Organization.create({ name: slug, slug }, START);
  organizations.items.push(organization);
  roles.seedDefaults(organization.id, START);
  return organization;
}

function seedCustom(key: string, organization = acme): CustomPermission {
  const permission = CustomPermission.create(
    { organizationId: organization.id, key, description: `Descrição ${key}` },
    START,
  );
  customPermissions.seed(permission);
  return permission;
}

function seedRole(name: string, permissions: string[]): Role {
  const role = Role.create(
    { organizationId: acme.id, name, permissions },
    PermissionCatalog.withCustom(customPermissions.items.map((p) => p.key)),
    START,
  );
  roles.seed(role);
  return role;
}

function as(who: { sub: string }) {
  return { cognitoSub: who.sub, organizationId: acme.id };
}

describe('Permissões personalizadas', () => {
  beforeEach(() => {
    const clock = new FixedClock(LATER);
    roles = new InMemoryRoleRepository();
    memberships = new InMemoryMembershipRepository(roles);
    organizations = new InMemoryOrganizationRepository();
    customPermissions = new InMemoryCustomPermissionRepository(roles);
    const users = new FakeUserDirectory();
    users.register(OWNER.sub, OWNER.id);
    users.register(MEMBER.sub, MEMBER.id);
    users.register(OUTSIDER.sub, OUTSIDER.id);

    const transactions = new FakeTransactionManager();
    const access = new OrganizationAccessService(
      organizations,
      memberships,
      roles,
    );
    listPermissions = new ListOrganizationPermissionsUseCase(
      customPermissions,
      users,
      access,
    );
    createPermission = new CreatePermissionUseCase(
      organizations,
      customPermissions,
      users,
      access,
      transactions,
      clock,
    );
    updatePermission = new UpdatePermissionUseCase(
      organizations,
      customPermissions,
      users,
      access,
      transactions,
      clock,
    );
    deletePermission = new DeletePermissionUseCase(
      organizations,
      customPermissions,
      users,
      access,
      transactions,
    );

    acme = createOrganization('acme');
    memberRole = roles.systemRole(acme.id, RoleSystemKey.MEMBER);
    for (const [userId, systemKey] of [
      [OWNER.id, RoleSystemKey.OWNER],
      [MEMBER.id, RoleSystemKey.MEMBER],
    ] as const) {
      memberships.items.push(
        Membership.create(
          {
            organizationId: acme.id,
            userId,
            roleId: roles.systemRole(acme.id, systemKey).id,
          },
          START,
        ),
      );
    }
  });

  describe('ListOrganizationPermissionsUseCase', () => {
    it('sistema na ordem do catálogo, depois personalizadas por chave, só da organização', async () => {
      seedCustom('invoices:approve');
      seedCustom('contracts:sign');
      seedCustom('payments:refund', createOrganization('beta'));

      const result = await listPermissions.execute({
        ...as(OWNER),
        organizationId: acme.id.toUpperCase(),
      });

      expect(result).toEqual([
        ...PERMISSION_CATALOG.map(({ key, description }) => ({
          key,
          description,
          isSystem: true,
        })),
        {
          key: 'contracts:sign',
          description: 'Descrição contracts:sign',
          isSystem: false,
        },
        {
          key: 'invoices:approve',
          description: 'Descrição invoices:approve',
          isSystem: false,
        },
      ]);
    });

    it('exige roles:read; não membro recebe NOT_FOUND', async () => {
      await expect(listPermissions.execute(as(MEMBER))).rejects.toBeInstanceOf(
        OrganizationPermissionDeniedError,
      );
      roles.grant(memberRole.id, ROLES_READ);
      await expect(listPermissions.execute(as(MEMBER))).resolves.toBeDefined();
      await expect(
        listPermissions.execute(as(OUTSIDER)),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });
  });

  describe('CreatePermissionUseCase', () => {
    function create(key: string, description = 'Aprovar', who = OWNER) {
      return createPermission.execute({ ...as(who), key, description });
    }

    it('cria com a descrição normalizada e não concede a ninguém', async () => {
      const result = await create('invoices:approve', '  Aprovar   faturas ');

      expect(result).toEqual({
        key: 'invoices:approve',
        description: 'Aprovar faturas',
        isSystem: false,
      });
      expect(
        await customPermissions.findByKey(acme.id, 'invoices:approve'),
      ).toMatchObject({ createdAt: LATER });
      expect(roles.items.flatMap((r) => r.permissions)).not.toContain(
        'invoices:approve',
      );
    });

    it('formato inválido, recurso reservado e descrição vazia', async () => {
      await expect(create('Invoices:Approve')).rejects.toBeInstanceOf(
        InvalidPermissionKeyError,
      );
      await expect(create('roles:approve')).rejects.toBeInstanceOf(
        ReservedPermissionResourceError,
      );
      await expect(create('invoices:approve', '  ')).rejects.toBeInstanceOf(
        InvalidPermissionDescriptionError,
      );
      expect(customPermissions.items).toHaveLength(0);
    });

    it('chave repetida na organização: PERMISSION_KEY_TAKEN; em outra organização, passa', async () => {
      seedCustom('invoices:approve', createOrganization('beta'));
      await create('invoices:approve');

      await expect(create('invoices:approve')).rejects.toBeInstanceOf(
        PermissionKeyTakenError,
      );
      expect(customPermissions.items).toHaveLength(2);
    });

    it('limite de 100 por organização', async () => {
      for (let i = 1; i < CustomPermission.MAX_PER_ORGANIZATION; i++) {
        seedCustom(`resource-${i}:read`);
      }

      await expect(create('resource-100:read')).resolves.toBeDefined();
      await expect(create('resource-101:read')).rejects.toBeInstanceOf(
        PermissionLimitReachedError,
      );
      expect(CustomPermission.MAX_PER_ORGANIZATION).toBe(100);
    });

    it('exige permissions:manage; não membro recebe NOT_FOUND', async () => {
      await expect(
        create('invoices:approve', 'Aprovar', MEMBER),
      ).rejects.toBeInstanceOf(OrganizationPermissionDeniedError);
      await expect(
        create('invoices:approve', 'Aprovar', OUTSIDER),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);

      roles.grant(memberRole.id, PERMISSIONS_MANAGE);
      await expect(
        create('invoices:approve', 'Aprovar', MEMBER),
      ).resolves.toBeDefined();
    });
  });

  describe('UpdatePermissionUseCase', () => {
    it('troca só a descrição', async () => {
      seedCustom('invoices:approve');

      const result = await updatePermission.execute({
        ...as(OWNER),
        key: 'invoices:approve',
        description: ' Aprovar  notas ',
      });

      expect(result).toEqual({
        key: 'invoices:approve',
        description: 'Aprovar notas',
        isSystem: false,
      });
      expect(
        await customPermissions.findByKey(acme.id, 'invoices:approve'),
      ).toMatchObject({ description: 'Aprovar notas', updatedAt: LATER });
    });

    it.each([
      ['inexistente', 'invoices:refund'],
      ['de outra organização', 'payments:refund'],
      ['de sistema', MEMBERS_READ],
      ['mal formada', 'Invoices:Approve'],
    ])('chave %s: PERMISSION_NOT_FOUND', async (_, key) => {
      seedCustom('payments:refund', createOrganization('beta'));

      await expect(
        updatePermission.execute({ ...as(OWNER), key, description: 'X' }),
      ).rejects.toBeInstanceOf(PermissionNotFoundError);
    });

    it('exige permissions:manage; não membro recebe NOT_FOUND', async () => {
      seedCustom('invoices:approve');
      const input = { key: 'invoices:approve', description: 'X' };

      await expect(
        updatePermission.execute({ ...as(MEMBER), ...input }),
      ).rejects.toBeInstanceOf(OrganizationPermissionDeniedError);
      await expect(
        updatePermission.execute({ ...as(OUTSIDER), ...input }),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });
  });

  describe('DeletePermissionUseCase', () => {
    function remove(key: string, who = OWNER) {
      return deletePermission.execute({ ...as(who), key });
    }

    it('exclui a que nenhum papel concede', async () => {
      seedCustom('invoices:approve');

      await remove('invoices:approve');

      expect(
        await customPermissions.findByKey(acme.id, 'invoices:approve'),
      ).toBeNull();
    });

    it('papel não apagado com a chave: PERMISSION_IN_USE', async () => {
      seedCustom('invoices:approve');
      seedRole('Financeiro', ['invoices:approve']);

      await expect(remove('invoices:approve')).rejects.toBeInstanceOf(
        PermissionInUseError,
      );
      expect(
        await customPermissions.findByKey(acme.id, 'invoices:approve'),
      ).not.toBeNull();
    });

    it('papel apagado não conta; a linha órfã dele sai junto', async () => {
      seedCustom('invoices:approve');
      const old = seedRole('Antigo', ['invoices:approve', MEMBERS_READ]);
      old.softDelete(START);
      roles.seed(old);

      await remove('invoices:approve');

      expect(roles.items.find((r) => r.id === old.id)?.permissions).toEqual([
        MEMBERS_READ,
      ]);
    });

    it.each([
      ['de sistema', MEMBERS_READ],
      ['inexistente', 'invoices:refund'],
      ['de outra organização', 'payments:refund'],
    ])('chave %s: PERMISSION_NOT_FOUND', async (_, key) => {
      seedCustom('payments:refund', createOrganization('beta'));

      await expect(remove(key)).rejects.toBeInstanceOf(PermissionNotFoundError);
    });

    it('exige permissions:manage; não membro recebe NOT_FOUND', async () => {
      seedCustom('invoices:approve');

      await expect(remove('invoices:approve', MEMBER)).rejects.toBeInstanceOf(
        OrganizationPermissionDeniedError,
      );
      await expect(remove('invoices:approve', OUTSIDER)).rejects.toBeInstanceOf(
        OrganizationNotFoundError,
      );
    });
  });
});
