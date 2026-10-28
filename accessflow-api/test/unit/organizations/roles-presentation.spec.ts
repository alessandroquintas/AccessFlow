import { describe, expect, it, vi } from 'vitest';
import { Role } from '@/modules/organizations/domain/entities/role.entity';
import { CountMembersByRoleUseCase } from '@/modules/organizations/application/use-cases/count-members-by-role.use-case';
import { GetPermissionCatalogUseCase } from '@/modules/organizations/application/use-cases/get-permission-catalog.use-case';
import {
  OrganizationPermission,
  PermissionCatalog,
} from '@/modules/organizations/policies/organization-permission';
import {
  MembershipRole,
  membershipRoleOf,
  systemKeyOf,
} from '@/modules/organizations/presentation/membership-role';
import { RolesResolver } from '@/modules/organizations/presentation/graphql/resolvers/roles.resolver';
import { OrganizationRoleType } from '@/modules/organizations/presentation/graphql/types/organization-role.type';

const NOW = new Date('2026-03-01T12:00:00.000Z');

function custom(organizationId: string, name: string): Role {
  return Role.create(
    { organizationId, name, permissions: [] },
    PermissionCatalog.system(),
    NOW,
  );
}

describe('MembershipRole', () => {
  const { owner, member } = Role.createDefaults('org-1', NOW);

  it('papel de sistema sai pelo systemKey; personalizado, como CUSTOM', () => {
    expect(membershipRoleOf(owner)).toBe(MembershipRole.OWNER);
    expect(membershipRoleOf(member)).toBe(MembershipRole.MEMBER);
    expect(membershipRoleOf(custom('org-1', 'Financeiro'))).toBe(
      MembershipRole.CUSTOM,
    );
  });

  it('CUSTOM não identifica um papel de sistema', () => {
    expect(systemKeyOf(MembershipRole.OWNER)).toBe('OWNER');
    expect(systemKeyOf(MembershipRole.CUSTOM)).toBeNull();
  });
});

function setupResolver(
  counts: Record<string, Record<string, number>> = {},
  customKeys: Record<string, string[]> = {},
) {
  const countMembers = vi.fn(async (organizationId: string) => {
    return new Map(Object.entries(counts[organizationId] ?? {}));
  });
  const loadCatalog = vi.fn(async (organizationId: string) =>
    PermissionCatalog.withCustom(customKeys[organizationId] ?? []),
  );
  const unused = {} as never;
  const resolver = new RolesResolver(
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    { execute: countMembers } as unknown as CountMembersByRoleUseCase,
    { execute: loadCatalog } as unknown as GetPermissionCatalogUseCase,
  );
  return { resolver, countMembers, loadCatalog };
}

describe('RolesResolver.permissions', () => {
  it('OWNER recebe o catálogo efetivo da organização; os demais, as gravadas, sem consultar', async () => {
    const { owner, member } = Role.createDefaults('org-1', NOW);
    const { resolver, loadCatalog } = setupResolver(
      {},
      { 'org-1': ['invoices:approve'] },
    );

    expect(
      await resolver.permissions(OrganizationRoleType.from(member), {}),
    ).toEqual([OrganizationPermission.MEMBERS_READ]);
    expect(loadCatalog).not.toHaveBeenCalled();

    expect(
      await resolver.permissions(OrganizationRoleType.from(owner), {}),
    ).toEqual([...Object.values(OrganizationPermission), 'invoices:approve']);
  });

  it('um catálogo por organização e requisição', async () => {
    const a = Role.createDefaults('org-a', NOW).owner;
    const b = Role.createDefaults('org-b', NOW).owner;
    const { resolver, loadCatalog } = setupResolver();
    const request = {};

    await Promise.all(
      [a, a, b].map((role) =>
        resolver.permissions(OrganizationRoleType.from(role), request),
      ),
    );

    expect(loadCatalog.mock.calls).toEqual([['org-a'], ['org-b']]);
  });
});

describe('RolesResolver.memberCount', () => {
  function setup(counts: Record<string, Record<string, number>>) {
    const { resolver, countMembers } = setupResolver(counts);
    return { resolver, execute: countMembers };
  }

  it('usa a contagem que o caso de uso já trouxe, sem consultar', async () => {
    const { resolver, execute } = setup({});
    const role = OrganizationRoleType.from(custom('org-1', 'Financeiro'), 7);

    expect(await resolver.memberCount(role, {})).toBe(7);
    expect(execute).not.toHaveBeenCalled();
  });

  it('uma consulta por organização e requisição, compartilhada pelos papéis', async () => {
    const [a1, a2, a3] = ['A', 'B', 'C'].map((name) => custom('org-a', name));
    const b1 = custom('org-b', 'D');
    const { resolver, execute } = setup({
      'org-a': { [a1.id]: 2, [a2.id]: 5 },
      'org-b': { [b1.id]: 1 },
    });
    const request = {};

    const counts = await Promise.all(
      [a1, a2, a3, b1].map((role) =>
        resolver.memberCount(OrganizationRoleType.from(role), request),
      ),
    );

    expect(counts).toEqual([2, 5, 0, 1]);
    expect(execute.mock.calls).toEqual([['org-a'], ['org-b']]);

    // Outra requisição consulta de novo.
    await resolver.memberCount(OrganizationRoleType.from(a1), {});
    expect(execute).toHaveBeenCalledTimes(3);
  });
});
