import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import {
  OrganizationPermission,
  PERMISSION_CATALOG,
} from '@/modules/organizations/policies/organization-permission';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { FakeIdentityProfileProvider } from '@test/fakes/identity/fake-identity-profile-provider';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';
import {
  seedMembership,
  seedRole,
  systemRoleId,
} from '@test/factory/organizations/seed-organization';

const ALL = Object.values(OrganizationPermission);
const {
  MEMBERS_READ,
  MEMBERS_INVITE,
  MEMBERS_REMOVE,
  ROLES_READ,
  ROLES_MANAGE,
  ROLES_ASSIGN,
} = OrganizationPermission;

const PROVISION = `mutation Provision($name: String!) {
  provisionMe(input: { name: $name }) { id }
}`;
const CREATE_ORGANIZATION = `mutation Create($name: String!, $slug: String!) {
  createOrganization(input: { name: $name, slug: $slug }) { id }
}`;
const ROLE_FIELDS = 'id name systemKey permissions memberCount createdAt';
const ROLES = `query Roles($orgId: ID!) {
  organizationRoles(organizationId: $orgId) { ${ROLE_FIELDS} }
}`;
const CATALOG = `query { permissionCatalog { key description } }`;
const MY_PERMISSIONS = `query Mine($orgId: ID!) { myPermissions(organizationId: $orgId) }`;
const CREATE_ROLE = `mutation CreateRole($orgId: ID!, $name: String!, $permissions: [String!]!) {
  createRole(organizationId: $orgId, input: { name: $name, permissions: $permissions }) { ${ROLE_FIELDS} }
}`;
const UPDATE_ROLE = `mutation UpdateRole($orgId: ID!, $roleId: ID!, $name: String, $permissions: [String!]) {
  updateRole(organizationId: $orgId, input: { roleId: $roleId, name: $name, permissions: $permissions }) { ${ROLE_FIELDS} }
}`;
const DELETE_ROLE = `mutation DeleteRole($orgId: ID!, $roleId: ID!) {
  deleteRole(organizationId: $orgId, roleId: $roleId)
}`;
const ASSIGN_ROLE = `mutation Assign($orgId: ID!, $userId: ID!, $roleId: ID!) {
  assignRole(organizationId: $orgId, input: { userId: $userId, roleId: $roleId }) {
    userId role assignedRole { id name memberCount }
  }
}`;
const INVITE = `mutation Invite($orgId: ID!, $email: String!, $role: MembershipRole, $roleId: ID) {
  inviteMember(organizationId: $orgId, input: { email: $email, role: $role, roleId: $roleId }) {
    id role assignedRole { id name systemKey permissions }
  }
}`;
const MY_INVITATIONS = `query { myInvitations { id role assignedRole { id name permissions } } }`;
const ACCEPT = `mutation Accept($id: ID!) {
  acceptInvitation(invitationId: $id) {
    id viewerRole viewerAssignedRole { id name memberCount }
  }
}`;
const MEMBERS = `query Members($orgId: ID!) {
  organizationMembers(organizationId: $orgId) {
    nodes { userId role assignedRole { id name systemKey memberCount } }
  }
}`;
const REVOKE = `mutation Revoke($orgId: ID!, $id: ID!) {
  revokeInvitation(organizationId: $orgId, invitationId: $id)
}`;

let app: INestApplication;
let prisma: PrismaService;
let tokens: FakeTokenVerifier;
let profiles: FakeIdentityProfileProvider;

function graphql(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string,
) {
  const req = request(app.getHttpServer())
    .post('/graphql')
    .set('Content-Type', 'application/json');
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send({ query, variables });
}

/** Resposta sem erro: devolve `data[field]`. */
async function ok<T = any>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
): Promise<T> {
  const res = await graphql(query, variables, token);
  expect(res.body.errors).toBeUndefined();
  const [field] = Object.keys(res.body.data);
  return res.body.data[field] as T;
}

function expectError(
  res: request.Response,
  extensions: { code: string; reason: string },
) {
  expect(res.body.errors[0].extensions).toEqual(extensions);
}

/** Provisiona pelo fluxo real: o e-mail do perfil vem do provedor. */
async function provision(sub: string, name: string) {
  tokens.register(`token-${sub}`, { sub });
  profiles.register(`token-${sub}`, { sub, email: `${sub}@example.com` });
  return ok<{ id: string }>(PROVISION, { name }, `token-${sub}`);
}

describe('Papéis (e2e)', () => {
  let ana: { id: string };
  let bruno: { id: string };
  let orgId: string;
  let ownerRoleId: string;
  let memberRoleId: string;

  beforeAll(async () => {
    tokens = new FakeTokenVerifier();
    profiles = new FakeIdentityProfileProvider();
    app = await createTestApp(tokens, profiles);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    tokens.reset();
    profiles.reset();
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "memberships", "organizations", "users" CASCADE`;

    ana = await provision('ana', 'Ana');
    bruno = await provision('bruno', 'Bruno');
    await provision('carla', 'Carla');
    ({ id: orgId } = await ok<{ id: string }>(
      CREATE_ORGANIZATION,
      { name: 'Acme', slug: 'acme' },
      'token-ana',
    ));
    ownerRoleId = await systemRoleId(prisma, orgId, 'OWNER');
    memberRoleId = await systemRoleId(prisma, orgId, 'MEMBER');
  });

  function createRole(
    name: string,
    permissions: string[],
    token = 'token-ana',
  ) {
    return graphql(CREATE_ROLE, { orgId, name, permissions }, token);
  }

  /** Bruno entra como membro com um papel customizado com estas permissões. */
  async function brunoWith(permissions: string[]): Promise<string> {
    const roleId = await seedRole(prisma, {
      organizationId: orgId,
      name: 'Gestor',
      permissions,
    });
    await seedMembership(prisma, {
      organizationId: orgId,
      userId: bruno.id,
      roleId,
    });
    return roleId;
  }

  it('fluxo completo: cria papel, convida com ele, aceita, troca, tenta apagar em uso, libera e apaga', async () => {
    // Cria o papel: permissões sem repetição, na ordem do catálogo.
    const finance = await ok(
      CREATE_ROLE,
      {
        orgId,
        name: '  Financeiro ',
        permissions: [MEMBERS_INVITE, MEMBERS_READ, MEMBERS_INVITE],
      },
      'token-ana',
    );
    expect(finance).toMatchObject({
      name: 'Financeiro',
      systemKey: null,
      permissions: [MEMBERS_READ, MEMBERS_INVITE],
      memberCount: 0,
    });

    // Convida com roleId: o papel antigo sai como CUSTOM.
    const invitation = await ok(
      INVITE,
      { orgId, email: 'bruno@example.com', roleId: finance.id },
      'token-ana',
    );
    expect(invitation).toMatchObject({
      role: 'CUSTOM',
      assignedRole: {
        id: finance.id,
        name: 'Financeiro',
        systemKey: null,
        permissions: [MEMBERS_READ, MEMBERS_INVITE],
      },
    });
    expect(await ok(MY_INVITATIONS, {}, 'token-bruno')).toEqual([
      {
        id: invitation.id,
        role: 'CUSTOM',
        assignedRole: {
          id: finance.id,
          name: 'Financeiro',
          permissions: [MEMBERS_READ, MEMBERS_INVITE],
        },
      },
    ]);

    // Aceita e entra com o papel do convite.
    expect(await ok(ACCEPT, { id: invitation.id }, 'token-bruno')).toEqual({
      id: orgId,
      viewerRole: 'CUSTOM',
      viewerAssignedRole: {
        id: finance.id,
        name: 'Financeiro',
        memberCount: 1,
      },
    });
    expect(await ok(MEMBERS, { orgId }, 'token-ana')).toMatchObject({
      nodes: [
        {
          userId: ana.id,
          role: 'OWNER',
          assignedRole: { id: ownerRoleId, systemKey: 'OWNER', memberCount: 1 },
        },
        {
          userId: bruno.id,
          role: 'CUSTOM',
          assignedRole: { id: finance.id, systemKey: null, memberCount: 1 },
        },
      ],
    });

    // Permissões efetivas de cada um.
    expect(await ok(MY_PERMISSIONS, { orgId }, 'token-bruno')).toEqual([
      MEMBERS_READ,
      MEMBERS_INVITE,
    ]);
    expect(await ok(MY_PERMISSIONS, { orgId }, 'token-ana')).toEqual(ALL);

    // Troca de papel para outro customizado.
    const accounting = await ok(
      CREATE_ROLE,
      { orgId, name: 'Contábil', permissions: [MEMBERS_READ] },
      'token-ana',
    );
    expect(
      await ok(
        ASSIGN_ROLE,
        { orgId, userId: bruno.id, roleId: accounting.id },
        'token-ana',
      ),
    ).toEqual({
      userId: bruno.id,
      role: 'CUSTOM',
      assignedRole: { id: accounting.id, name: 'Contábil', memberCount: 1 },
    });
    expect(await ok(MY_PERMISSIONS, { orgId }, 'token-bruno')).toEqual([
      MEMBERS_READ,
    ]);

    // Em uso: não apaga.
    expectError(
      await graphql(DELETE_ROLE, { orgId, roleId: accounting.id }, 'token-ana'),
      { code: 'CONFLICT', reason: 'ROLE_IN_USE' },
    );

    // Libera (volta para MEMBER) e apaga.
    await ok(
      ASSIGN_ROLE,
      { orgId, userId: bruno.id, roleId: memberRoleId },
      'token-ana',
    );
    expect(
      await ok(DELETE_ROLE, { orgId, roleId: accounting.id }, 'token-ana'),
    ).toBe(true);

    const roles = await ok<{ id: string; name: string; memberCount: number }[]>(
      ROLES,
      { orgId },
      'token-ana',
    );
    expect(roles.map(({ name, memberCount }) => [name, memberCount])).toEqual([
      ['Owner', 1],
      ['Member', 1],
      ['Financeiro', 0],
    ]);
  });

  it('organizationRoles: OWNER com o catálogo inteiro, MEMBER com members:read', async () => {
    const roles = await ok(ROLES, { orgId }, 'token-ana');

    expect(roles).toEqual([
      expect.objectContaining({
        id: ownerRoleId,
        name: 'Owner',
        systemKey: 'OWNER',
        permissions: ALL,
        memberCount: 1,
      }),
      expect.objectContaining({
        id: memberRoleId,
        name: 'Member',
        systemKey: 'MEMBER',
        permissions: [MEMBERS_READ],
        memberCount: 0,
      }),
    ]);
  });

  it('permissionCatalog: o catálogo do domínio; exige autenticação', async () => {
    expect(await ok(CATALOG, {}, 'token-carla')).toEqual(
      PERMISSION_CATALOG.map(({ key, description }) => ({ key, description })),
    );
    expect(
      (await ok<{ key: string }[]>(CATALOG, {}, 'token-carla')).map(
        (p) => p.key,
      ),
    ).toEqual(expect.arrayContaining([ROLES_READ, ROLES_MANAGE, ROLES_ASSIGN]));

    expectError(await graphql(CATALOG), {
      code: 'UNAUTHENTICATED',
      reason: 'INVALID_ACCESS_TOKEN',
    });
  });

  it('não membro recebe NOT_FOUND em todas as operações de papel', async () => {
    const notFound = { code: 'NOT_FOUND', reason: 'ORGANIZATION_NOT_FOUND' };
    const token = 'token-carla';

    for (const [query, variables] of [
      [ROLES, { orgId }],
      [MY_PERMISSIONS, { orgId }],
      [CREATE_ROLE, { orgId, name: 'X', permissions: [] }],
      [UPDATE_ROLE, { orgId, roleId: memberRoleId, permissions: [] }],
      [DELETE_ROLE, { orgId, roleId: memberRoleId }],
      [ASSIGN_ROLE, { orgId, userId: ana.id, roleId: memberRoleId }],
    ] as const) {
      expectError(await graphql(query, variables, token), notFound);
    }
  });

  it('membro sem a permissão recebe FORBIDDEN; myPermissions só exige ser membro', async () => {
    await seedMembership(prisma, { organizationId: orgId, userId: bruno.id });
    const forbidden = {
      code: 'FORBIDDEN',
      reason: 'ORGANIZATION_PERMISSION_DENIED',
    };
    const token = 'token-bruno';

    for (const [query, variables] of [
      [ROLES, { orgId }],
      [CREATE_ROLE, { orgId, name: 'X', permissions: [] }],
      [UPDATE_ROLE, { orgId, roleId: memberRoleId, permissions: [] }],
      [DELETE_ROLE, { orgId, roleId: memberRoleId }],
      [ASSIGN_ROLE, { orgId, userId: ana.id, roleId: memberRoleId }],
    ] as const) {
      expectError(await graphql(query, variables, token), forbidden);
    }
    expect(await ok(MY_PERMISSIONS, { orgId }, token)).toEqual([MEMBERS_READ]);
  });

  it('PRIVILEGE_ESCALATION: não concede, não tira e não atribui o que não tem', async () => {
    const managerId = await brunoWith([
      MEMBERS_READ,
      MEMBERS_INVITE,
      ROLES_MANAGE,
      ROLES_ASSIGN,
    ]);
    const remover = await seedRole(prisma, {
      organizationId: orgId,
      name: 'Removedor',
      permissions: [MEMBERS_REMOVE],
    });
    await provision('davi', 'Davi');
    const davi = await prisma.user.findFirstOrThrow({
      where: { cognitoSub: 'davi' },
    });
    await seedMembership(prisma, { organizationId: orgId, userId: davi.id });
    const escalation = { code: 'FORBIDDEN', reason: 'PRIVILEGE_ESCALATION' };
    const token = 'token-bruno';

    for (const [query, variables] of [
      // Cria com permissão que não tem.
      [CREATE_ROLE, { orgId, name: 'Maior', permissions: [MEMBERS_REMOVE] }],
      // Tira permissão que não tem.
      [UPDATE_ROLE, { orgId, roleId: remover, permissions: [] }],
      // Autopromoção a OWNER e atribuição de papel que não cobre.
      [ASSIGN_ROLE, { orgId, userId: bruno.id, roleId: ownerRoleId }],
      [ASSIGN_ROLE, { orgId, userId: davi.id, roleId: remover }],
      // Mexer em quem é OWNER.
      [ASSIGN_ROLE, { orgId, userId: ana.id, roleId: memberRoleId }],
      // Convidar como OWNER.
      [INVITE, { orgId, email: 'eva@example.com', role: 'OWNER' }],
    ] as const) {
      expectError(await graphql(query, variables, token), escalation);
    }

    // O que ele cobre passa.
    expect(
      await ok(
        ASSIGN_ROLE,
        { orgId, userId: davi.id, roleId: managerId },
        token,
      ),
    ).toMatchObject({ role: 'CUSTOM', assignedRole: { id: managerId } });
  });

  it('papel de outra organização: ROLE_NOT_FOUND, sem revelar que existe', async () => {
    const beta = await ok<{ id: string }>(
      CREATE_ORGANIZATION,
      { name: 'Beta', slug: 'beta' },
      'token-ana',
    );
    const foreign = await seedRole(prisma, {
      organizationId: beta.id,
      name: 'Financeiro',
    });
    await seedMembership(prisma, { organizationId: orgId, userId: bruno.id });
    const notFound = { code: 'NOT_FOUND', reason: 'ROLE_NOT_FOUND' };

    for (const roleId of [foreign, crypto.randomUUID(), 'nao-e-uuid']) {
      for (const [query, variables] of [
        [UPDATE_ROLE, { orgId, roleId, name: 'X' }],
        [DELETE_ROLE, { orgId, roleId }],
        [ASSIGN_ROLE, { orgId, userId: bruno.id, roleId }],
        [INVITE, { orgId, email: 'eva@example.com', roleId }],
      ] as const) {
        expectError(await graphql(query, variables, 'token-ana'), notFound);
      }
    }
  });

  it('SYSTEM_ROLE_IMMUTABLE: OWNER não muda; MEMBER só muda as permissões; nenhum é apagado', async () => {
    const immutable = { code: 'CONFLICT', reason: 'SYSTEM_ROLE_IMMUTABLE' };

    for (const [query, variables] of [
      [UPDATE_ROLE, { orgId, roleId: ownerRoleId, name: 'Dono' }],
      [UPDATE_ROLE, { orgId, roleId: ownerRoleId, permissions: [] }],
      [UPDATE_ROLE, { orgId, roleId: memberRoleId, name: 'Membro' }],
      [DELETE_ROLE, { orgId, roleId: ownerRoleId }],
      [DELETE_ROLE, { orgId, roleId: memberRoleId }],
    ] as const) {
      expectError(await graphql(query, variables, 'token-ana'), immutable);
    }

    expect(
      await ok(
        UPDATE_ROLE,
        {
          orgId,
          roleId: memberRoleId,
          permissions: [MEMBERS_READ, ROLES_READ],
        },
        'token-ana',
      ),
    ).toMatchObject({
      name: 'Member',
      systemKey: 'MEMBER',
      permissions: [MEMBERS_READ, ROLES_READ],
    });
  });

  it('ROLE_NAME_TAKEN sem diferenciar a caixa; trocar só a caixa do próprio nome passa', async () => {
    const taken = { code: 'CONFLICT', reason: 'ROLE_NAME_TAKEN' };
    const finance = await ok(
      CREATE_ROLE,
      { orgId, name: 'gerente', permissions: [] },
      'token-ana',
    );

    expectError(await createRole('owner', []), taken);
    expectError(await createRole('  GERENTE ', []), taken);
    expectError(
      await graphql(
        UPDATE_ROLE,
        { orgId, roleId: finance.id, name: 'Member' },
        'token-ana',
      ),
      taken,
    );
    expect(
      await ok(
        UPDATE_ROLE,
        { orgId, roleId: finance.id, name: 'Gerente' },
        'token-ana',
      ),
    ).toMatchObject({ name: 'Gerente' });
  });

  it('entrada inválida: INVALID_PERMISSION, INVALID_ROLE e role/roleId no convite', async () => {
    expectError(await createRole('Financeiro', ['billing:read']), {
      code: 'BAD_REQUEST',
      reason: 'INVALID_PERMISSION',
    });
    expectError(await createRole('   ', []), {
      code: 'BAD_REQUEST',
      reason: 'INVALID_ROLE',
    });

    const invalid = { code: 'BAD_REQUEST', reason: 'INVALID_INVITATION' };
    for (const choice of [
      { role: 'MEMBER', roleId: memberRoleId },
      {},
      { role: 'CUSTOM' },
    ]) {
      expectError(
        await graphql(
          INVITE,
          { orgId, email: 'eva@example.com', ...choice },
          'token-ana',
        ),
        invalid,
      );
    }
    expect(await prisma.invitation.count()).toBe(0);
  });

  it('convite PENDING prende o papel; revogar libera a exclusão', async () => {
    const finance = await ok(
      CREATE_ROLE,
      { orgId, name: 'Financeiro', permissions: [] },
      'token-ana',
    );
    const invitation = await ok(
      INVITE,
      { orgId, email: 'eva@example.com', roleId: finance.id },
      'token-ana',
    );

    expectError(
      await graphql(DELETE_ROLE, { orgId, roleId: finance.id }, 'token-ana'),
      { code: 'CONFLICT', reason: 'ROLE_IN_USE' },
    );
    await ok(REVOKE, { orgId, id: invitation.id }, 'token-ana');
    expect(
      await ok(DELETE_ROLE, { orgId, roleId: finance.id }, 'token-ana'),
    ).toBe(true);
  });
});
