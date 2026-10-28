import { beforeEach, describe, expect, it } from 'vitest';
import {
  Organization,
  OrganizationStatus,
} from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import {
  Role,
  RoleSystemKey,
} from '@/modules/organizations/domain/entities/role.entity';
import { CustomPermission } from '@/modules/organizations/domain/entities/custom-permission.entity';
import {
  IntegrationClient,
  IntegrationClientStatus,
} from '@/modules/organizations/domain/entities/integration-client.entity';
import {
  OrganizationPermission,
  PermissionCatalog,
} from '@/modules/organizations/policies/organization-permission';
import { decidePermissions } from '@/modules/organizations/policies/authorization';
import {
  AuthorizeForIntegrationUseCase,
  MAX_AUTHORIZE_PERMISSIONS,
} from '@/modules/organizations/application/use-cases/authorize-for-integration.use-case';
import { InvalidAuthorizationRequestError } from '@/modules/organizations/application/errors/invalid-authorization-request.error';
import { InvalidPermissionKeyError } from '@/modules/organizations/domain/errors/invalid-permission-key.error';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { InMemoryOrganizationRepository } from '@test/in-memory/organizations/in-memory-organization-repository';
import { InMemoryMembershipRepository } from '@test/in-memory/organizations/in-memory-membership-repository';
import { InMemoryRoleRepository } from '@test/in-memory/organizations/in-memory-role-repository';
import { InMemoryCustomPermissionRepository } from '@test/in-memory/organizations/in-memory-custom-permission-repository';
import { InMemoryIntegrationClientRepository } from '@test/in-memory/organizations/in-memory-integration-client-repository';
import { InMemoryAuthorizationSnapshotReader } from '@test/in-memory/organizations/in-memory-authorization-snapshot-reader';
import { FakeUserDirectory } from '@test/fakes/organizations/fake-user-directory';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const { MEMBERS_READ, MEMBERS_INVITE, ROLES_MANAGE } = OrganizationPermission;
const APPROVE = 'invoices:approve';
const SIGN = 'contracts:sign';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const FINANCE_ID = '22222222-2222-4222-8222-222222222222';
const OUTSIDER_ID = '33333333-3333-4333-8333-333333333333';
const INACTIVE_ID = '44444444-4444-4444-8444-444444444444';
const REMOVED_ID = '55555555-5555-4555-8555-555555555555';
const UNKNOWN_ID = '66666666-6666-4666-8666-666666666666';

let roles: InMemoryRoleRepository;
let memberships: InMemoryMembershipRepository;
let organizations: InMemoryOrganizationRepository;
let customPermissions: InMemoryCustomPermissionRepository;
let integrationClients: InMemoryIntegrationClientRepository;
let sut: AuthorizeForIntegrationUseCase;
let acme: Organization;
let beta: Organization;
let finance: Role;

function addClient(
  clientId: string,
  organizationId: string,
  status: IntegrationClientStatus = IntegrationClientStatus.ACTIVE,
) {
  integrationClients.items.push(
    IntegrationClient.restore({
      id: crypto.randomUUID(),
      clientId,
      organizationId,
      name: clientId,
      status,
      createdAt: NOW,
      updatedAt: NOW,
    }),
  );
}

function addMember(organizationId: string, userId: string, roleId: string) {
  const membership = Membership.create({ organizationId, userId, roleId }, NOW);
  memberships.items.push(membership);
  return membership;
}

function authorize(
  userId: string,
  permissions: string[],
  overrides: { clientId?: string; organizationId?: string } = {},
) {
  return sut.execute({
    clientId: 'client-acme',
    organizationId: acme.id,
    userId,
    permissions,
    ...overrides,
  });
}

function allowedOf(result: { results: { allowed: boolean }[] }) {
  return result.results.map((r) => r.allowed);
}

describe('decidePermissions', () => {
  const { owner } = Role.createDefaults('org-1', NOW);
  const catalog = PermissionCatalog.withCustom([APPROVE]);

  it('a chave precisa existir no catálogo antes do grants(): OWNER + chave inexistente → false', () => {
    expect(
      decidePermissions(owner, catalog, [
        APPROVE,
        MEMBERS_READ,
        'invoices:refund',
      ]),
    ).toEqual([
      { permission: APPROVE, allowed: true },
      { permission: MEMBERS_READ, allowed: true },
      { permission: 'invoices:refund', allowed: false },
    ]);
    // Sem a checagem do catálogo, o grants() do OWNER diria true.
    expect(owner.grants('invoices:refund')).toBe(true);
  });

  it('sem papel, tudo false', () => {
    expect(decidePermissions(null, catalog, [APPROVE])).toEqual([
      { permission: APPROVE, allowed: false },
    ]);
  });
});

describe('AuthorizeForIntegrationUseCase', () => {
  beforeEach(async () => {
    roles = new InMemoryRoleRepository();
    memberships = new InMemoryMembershipRepository(roles);
    organizations = new InMemoryOrganizationRepository();
    customPermissions = new InMemoryCustomPermissionRepository(roles);
    integrationClients = new InMemoryIntegrationClientRepository();
    const users = new FakeUserDirectory();
    for (const id of [OWNER_ID, FINANCE_ID, OUTSIDER_ID, REMOVED_ID]) {
      users.register(`sub-${id}`, id);
    }
    users.register(`sub-${INACTIVE_ID}`, INACTIVE_ID, { active: false });

    sut = new AuthorizeForIntegrationUseCase(
      integrationClients,
      organizations,
      new InMemoryAuthorizationSnapshotReader(
        memberships,
        roles,
        customPermissions,
      ),
      users,
    );

    acme = Organization.create({ name: 'Acme', slug: 'acme' });
    beta = Organization.create({ name: 'Beta', slug: 'beta' });
    for (const organization of [acme, beta]) {
      await organizations.create(organization);
      roles.seedDefaults(organization.id, NOW);
    }
    for (const [organization, key] of [
      [acme, APPROVE],
      [acme, SIGN],
      [beta, 'payments:refund'],
    ] as const) {
      customPermissions.seed(
        CustomPermission.create(
          { organizationId: organization.id, key, description: key },
          NOW,
        ),
      );
    }
    finance = Role.create(
      {
        organizationId: acme.id,
        name: 'Financeiro',
        permissions: [MEMBERS_READ, APPROVE],
      },
      PermissionCatalog.withCustom([APPROVE, SIGN]),
      NOW,
    );
    roles.seed(finance);

    const ownerRole = roles.systemRole(acme.id, RoleSystemKey.OWNER);
    addMember(acme.id, OWNER_ID, ownerRole.id);
    addMember(acme.id, FINANCE_ID, finance.id);
    addMember(acme.id, INACTIVE_ID, ownerRole.id);
    addMember(acme.id, REMOVED_ID, finance.id).remove(NOW);
    addClient('client-acme', acme.id);
    addClient('client-revogado', acme.id, IntegrationClientStatus.REVOKED);
  });

  it('tudo permitido: allowed true, resultados na ordem do pedido', async () => {
    const result = await authorize(FINANCE_ID, [APPROVE, MEMBERS_READ]);

    expect(result).toEqual({
      organizationId: acme.id,
      userId: FINANCE_ID,
      allowed: true,
      results: [
        { permission: APPROVE, allowed: true },
        { permission: MEMBERS_READ, allowed: true },
      ],
    });
  });

  it('parcial: allowed false; repetidas saem, a ordem fica', async () => {
    const result = await authorize(FINANCE_ID, [
      SIGN,
      APPROVE,
      SIGN,
      MEMBERS_INVITE,
      APPROVE,
    ]);

    expect(result.allowed).toBe(false);
    expect(result.results).toEqual([
      { permission: SIGN, allowed: false },
      { permission: APPROVE, allowed: true },
      { permission: MEMBERS_INVITE, allowed: false },
    ]);
  });

  it('OWNER: sistema e personalizadas da organização true; chave inexistente em formato válido false', async () => {
    const result = await authorize(OWNER_ID, [
      APPROVE,
      ROLES_MANAGE,
      'invoices:refund',
      'payments:refund',
    ]);

    expect(allowedOf(result)).toEqual([true, true, false, false]);
    expect(result.allowed).toBe(false);
  });

  it.each([
    ['não membro', OUTSIDER_ID],
    ['membro removido', REMOVED_ID],
    ['conta desativada (mesmo OWNER com membership ativo)', INACTIVE_ID],
    ['usuário inexistente', UNKNOWN_ID],
  ])('%s: tudo false, no mesmo formato', async (_, userId) => {
    const result = await authorize(userId, [APPROVE, MEMBERS_READ]);

    expect(result).toEqual({
      organizationId: acme.id,
      userId,
      allowed: false,
      results: [
        { permission: APPROVE, allowed: false },
        { permission: MEMBERS_READ, allowed: false },
      ],
    });
  });

  it('normaliza os ids', async () => {
    const result = await authorize(FINANCE_ID.toUpperCase(), [APPROVE], {
      organizationId: acme.id.toUpperCase(),
    });

    expect(result).toMatchObject({
      organizationId: acme.id,
      userId: FINANCE_ID,
      allowed: true,
    });
  });

  describe('formato: 400 antes de olhar client e organização', () => {
    it.each([
      ['organizationId', { organizationId: 'nao-e-uuid' }],
      [
        'organizationId de outro tenant e malformado',
        { organizationId: 'x', clientId: 'client-nenhum' },
      ],
    ])('%s não UUID', async (_, overrides) => {
      await expect(
        authorize(FINANCE_ID, [APPROVE], overrides),
      ).rejects.toBeInstanceOf(InvalidAuthorizationRequestError);
    });

    it('userId não UUID', async () => {
      await expect(authorize('nao-e-uuid', [APPROVE])).rejects.toBeInstanceOf(
        InvalidAuthorizationRequestError,
      );
    });

    it('lista vazia e lista com 26 itens (mesmo repetidos)', async () => {
      expect(MAX_AUTHORIZE_PERMISSIONS).toBe(25);
      await expect(authorize(FINANCE_ID, [])).rejects.toBeInstanceOf(
        InvalidAuthorizationRequestError,
      );
      await expect(
        authorize(
          FINANCE_ID,
          Array.from({ length: 26 }, () => APPROVE),
        ),
      ).rejects.toBeInstanceOf(InvalidAuthorizationRequestError);
      await expect(
        authorize(
          FINANCE_ID,
          Array.from({ length: 25 }, (_, i) => `resource-${i}:read`),
        ),
      ).resolves.toMatchObject({ allowed: false });
    });

    it.each(['Invoices:Approve', 'invoices', 'a:b:c', ''])(
      'chave fora do formato (%j): INVALID_PERMISSION_KEY',
      async (key) => {
        await expect(
          authorize(FINANCE_ID, [APPROVE, key]),
        ).rejects.toBeInstanceOf(InvalidPermissionKeyError);
      },
    );
  });

  describe('vínculo do client: a mesma regra do GET de membros', () => {
    it.each([
      ['client desconhecido', () => ({ clientId: 'client-nenhum' })],
      ['client revogado', () => ({ clientId: 'client-revogado' })],
      ['organização de outro tenant', () => ({ organizationId: beta.id })],
    ])('%s: ORGANIZATION_NOT_FOUND', async (_, overrides) => {
      await expect(
        authorize(OWNER_ID, [APPROVE], overrides()),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });

    it('organização inativa: ORGANIZATION_NOT_FOUND', async () => {
      organizations.items = organizations.items.map((o) =>
        o.id === acme.id
          ? Organization.restore({
              id: o.id,
              name: o.name,
              slug: o.slug,
              status: OrganizationStatus.INACTIVE,
              createdAt: o.createdAt,
              updatedAt: o.updatedAt,
            })
          : o,
      );

      await expect(authorize(OWNER_ID, [APPROVE])).rejects.toBeInstanceOf(
        OrganizationNotFoundError,
      );
    });
  });

  it('papel apagado num membership ativo: falha fechada (erro interno)', async () => {
    finance.softDelete(NOW);
    roles.seed(finance);

    await expect(authorize(FINANCE_ID, [APPROVE])).rejects.toThrow(
      'Membership sem papel ativo na organização.',
    );
  });
});
