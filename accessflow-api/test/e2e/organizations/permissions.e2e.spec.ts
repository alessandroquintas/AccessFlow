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

const SYSTEM = Object.values(OrganizationPermission);
const { MEMBERS_READ, ROLES_MANAGE } = OrganizationPermission;
const APPROVE = 'invoices:approve';

const PROVISION = `mutation Provision($name: String!) {
  provisionMe(input: { name: $name }) { id }
}`;
const CREATE_ORGANIZATION = `mutation Create($name: String!, $slug: String!) {
  createOrganization(input: { name: $name, slug: $slug }) { id }
}`;
const PERMISSIONS = `query Permissions($orgId: ID!) {
  organizationPermissions(organizationId: $orgId) { key description isSystem }
}`;
const CATALOG = `query { permissionCatalog { key } }`;
const CREATE_PERMISSION = `mutation CreatePermission($orgId: ID!, $key: String!, $description: String!) {
  createPermission(organizationId: $orgId, input: { key: $key, description: $description }) {
    key description isSystem
  }
}`;
const UPDATE_PERMISSION = `mutation UpdatePermission($orgId: ID!, $key: String!, $description: String!) {
  updatePermission(organizationId: $orgId, input: { key: $key, description: $description }) {
    key description isSystem
  }
}`;
const DELETE_PERMISSION = `mutation DeletePermission($orgId: ID!, $key: String!) {
  deletePermission(organizationId: $orgId, key: $key)
}`;
const MY_PERMISSIONS = `query Mine($orgId: ID!) { myPermissions(organizationId: $orgId) }`;
const ROLES = `query Roles($orgId: ID!) {
  organizationRoles(organizationId: $orgId) { id name permissions }
}`;
const CREATE_ROLE = `mutation CreateRole($orgId: ID!, $name: String!, $permissions: [String!]!) {
  createRole(organizationId: $orgId, input: { name: $name, permissions: $permissions }) { id permissions }
}`;
const UPDATE_ROLE = `mutation UpdateRole($orgId: ID!, $roleId: ID!, $permissions: [String!]) {
  updateRole(organizationId: $orgId, input: { roleId: $roleId, permissions: $permissions }) { id permissions }
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

async function provision(sub: string, name: string) {
  tokens.register(`token-${sub}`, { sub });
  profiles.register(`token-${sub}`, { sub, email: `${sub}@example.com` });
  return ok<{ id: string }>(PROVISION, { name }, `token-${sub}`);
}

describe('Permissões personalizadas (e2e)', () => {
  let bruno: { id: string };
  let orgId: string;

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

    await provision('ana', 'Ana');
    bruno = await provision('bruno', 'Bruno');
    await provision('carla', 'Carla');
    ({ id: orgId } = await ok<{ id: string }>(
      CREATE_ORGANIZATION,
      { name: 'Acme', slug: 'acme' },
      'token-ana',
    ));
  });

  function createPermission(
    key: string,
    description = 'Aprovar faturas',
    token = 'token-ana',
    organizationId = orgId,
  ) {
    return graphql(
      CREATE_PERMISSION,
      { orgId: organizationId, key, description },
      token,
    );
  }

  /** Bruno entra com um papel customizado com estas permissões. */
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

  it('fluxo completo: cria, concede a um papel, o membro vê, não exclui em uso, tira do papel e exclui', async () => {
    // Cria: ninguém recebe além do OWNER.
    expect(
      await ok(
        CREATE_PERMISSION,
        { orgId, key: APPROVE, description: '  Aprovar   faturas ' },
        'token-ana',
      ),
    ).toEqual({
      key: APPROVE,
      description: 'Aprovar faturas',
      isSystem: false,
    });
    expect(await ok(PERMISSIONS, { orgId }, 'token-ana')).toEqual([
      ...PERMISSION_CATALOG.map(({ key, description }) => ({
        key,
        description,
        isSystem: true,
      })),
      { key: APPROVE, description: 'Aprovar faturas', isSystem: false },
    ]);
    expect(await ok(MY_PERMISSIONS, { orgId }, 'token-ana')).toEqual([
      ...SYSTEM,
      APPROVE,
    ]);
    const [owner, member] = await ok<{ name: string; permissions: string[] }[]>(
      ROLES,
      { orgId },
      'token-ana',
    );
    expect(owner.permissions).toEqual([...SYSTEM, APPROVE]);
    expect(member.permissions).toEqual([MEMBERS_READ]);

    // Edita a descrição; a chave não muda.
    expect(
      await ok(
        UPDATE_PERMISSION,
        { orgId, key: APPROVE, description: 'Aprovar notas fiscais' },
        'token-ana',
      ),
    ).toEqual({
      key: APPROVE,
      description: 'Aprovar notas fiscais',
      isSystem: false,
    });

    // Concede a um papel e o membro com esse papel passa a ter.
    const finance = await ok<{ id: string; permissions: string[] }>(
      CREATE_ROLE,
      { orgId, name: 'Financeiro', permissions: [APPROVE, MEMBERS_READ] },
      'token-ana',
    );
    expect(finance.permissions).toEqual([MEMBERS_READ, APPROVE]);
    await seedMembership(prisma, {
      organizationId: orgId,
      userId: bruno.id,
      roleId: finance.id,
    });
    expect(await ok(MY_PERMISSIONS, { orgId }, 'token-bruno')).toEqual([
      MEMBERS_READ,
      APPROVE,
    ]);

    // Em uso: não exclui.
    expectError(
      await graphql(DELETE_PERMISSION, { orgId, key: APPROVE }, 'token-ana'),
      { code: 'CONFLICT', reason: 'PERMISSION_IN_USE' },
    );

    // Tira do papel e exclui.
    await ok(
      UPDATE_ROLE,
      { orgId, roleId: finance.id, permissions: [MEMBERS_READ] },
      'token-ana',
    );
    expect(await ok(MY_PERMISSIONS, { orgId }, 'token-bruno')).toEqual([
      MEMBERS_READ,
    ]);
    expect(
      await ok(DELETE_PERMISSION, { orgId, key: APPROVE }, 'token-ana'),
    ).toBe(true);

    expect(
      (await ok<{ key: string }[]>(PERMISSIONS, { orgId }, 'token-ana')).map(
        (p) => p.key,
      ),
    ).toEqual(SYSTEM);
    expect(await ok(MY_PERMISSIONS, { orgId }, 'token-ana')).toEqual(SYSTEM);
    // Excluída, a chave não pode mais ser concedida.
    expectError(
      await graphql(
        UPDATE_ROLE,
        { orgId, roleId: finance.id, permissions: [APPROVE] },
        'token-ana',
      ),
      { code: 'BAD_REQUEST', reason: 'INVALID_PERMISSION' },
    );
  });

  it('permissionCatalog continua só com as de sistema, agora com permissions:manage', async () => {
    await ok(
      CREATE_PERMISSION,
      { orgId, key: APPROVE, description: 'X' },
      'token-ana',
    );

    const keys = (await ok<{ key: string }[]>(CATALOG, {}, 'token-ana')).map(
      (p) => p.key,
    );

    expect(keys).toEqual(SYSTEM);
    expect(keys).toContain('permissions:manage');
  });

  it('recurso reservado: RESERVED_PERMISSION_RESOURCE', async () => {
    for (const key of [
      'roles:approve',
      'members:export',
      'invitations:resend',
      'permissions:read',
      'organizations:archive',
      'audit:export',
    ]) {
      expectError(await createPermission(key), {
        code: 'BAD_REQUEST',
        reason: 'RESERVED_PERMISSION_RESOURCE',
      });
    }
  });

  it('formato inválido: INVALID_PERMISSION_KEY; descrição vazia: INVALID_PERMISSION_DESCRIPTION', async () => {
    for (const key of [
      'Invoices:Approve',
      'invoices',
      'a:b:c',
      'faturas:aprovação',
    ]) {
      expectError(await createPermission(key), {
        code: 'BAD_REQUEST',
        reason: 'INVALID_PERMISSION_KEY',
      });
    }
    expectError(await createPermission(APPROVE, '   '), {
      code: 'BAD_REQUEST',
      reason: 'INVALID_PERMISSION_DESCRIPTION',
    });
    expect(await prisma.customPermission.count()).toBe(0);
  });

  it('chave duplicada: PERMISSION_KEY_TAKEN', async () => {
    await ok(
      CREATE_PERMISSION,
      { orgId, key: APPROVE, description: 'X' },
      'token-ana',
    );

    expectError(await createPermission(APPROVE), {
      code: 'CONFLICT',
      reason: 'PERMISSION_KEY_TAKEN',
    });
  });

  it('PERMISSION_NOT_FOUND: chave de outra organização, inexistente ou de sistema', async () => {
    const beta = await ok<{ id: string }>(
      CREATE_ORGANIZATION,
      { name: 'Beta', slug: 'beta' },
      'token-ana',
    );
    await ok(
      CREATE_PERMISSION,
      { orgId: beta.id, key: 'payments:refund', description: 'Estornar' },
      'token-ana',
    );
    const notFound = { code: 'NOT_FOUND', reason: 'PERMISSION_NOT_FOUND' };

    for (const key of ['payments:refund', 'invoices:refund', MEMBERS_READ]) {
      expectError(
        await graphql(
          UPDATE_PERMISSION,
          { orgId, key, description: 'X' },
          'token-ana',
        ),
        notFound,
      );
      expectError(
        await graphql(DELETE_PERMISSION, { orgId, key }, 'token-ana'),
        notFound,
      );
    }
  });

  it('membro sem permissions:manage recebe FORBIDDEN; sem roles:read, também na listagem', async () => {
    await ok(
      CREATE_PERMISSION,
      { orgId, key: APPROVE, description: 'X' },
      'token-ana',
    );
    await seedMembership(prisma, { organizationId: orgId, userId: bruno.id });
    const forbidden = {
      code: 'FORBIDDEN',
      reason: 'ORGANIZATION_PERMISSION_DENIED',
    };
    const token = 'token-bruno';

    for (const [query, variables] of [
      [PERMISSIONS, { orgId }],
      [CREATE_PERMISSION, { orgId, key: 'contracts:sign', description: 'X' }],
      [UPDATE_PERMISSION, { orgId, key: APPROVE, description: 'X' }],
      [DELETE_PERMISSION, { orgId, key: APPROVE }],
    ] as const) {
      expectError(await graphql(query, variables, token), forbidden);
    }
  });

  it('não membro recebe NOT_FOUND da organização', async () => {
    const notFound = { code: 'NOT_FOUND', reason: 'ORGANIZATION_NOT_FOUND' };
    const token = 'token-carla';

    for (const [query, variables] of [
      [PERMISSIONS, { orgId }],
      [CREATE_PERMISSION, { orgId, key: APPROVE, description: 'X' }],
      [UPDATE_PERMISSION, { orgId, key: APPROVE, description: 'X' }],
      [DELETE_PERMISSION, { orgId, key: APPROVE }],
    ] as const) {
      expectError(await graphql(query, variables, token), notFound);
    }
  });

  it('anti-escalada: quem não tem a personalizada não a concede', async () => {
    await ok(
      CREATE_PERMISSION,
      { orgId, key: APPROVE, description: 'X' },
      'token-ana',
    );
    await ok(
      CREATE_PERMISSION,
      { orgId, key: 'contracts:sign', description: 'Y' },
      'token-ana',
    );
    await brunoWith([ROLES_MANAGE, MEMBERS_READ, APPROVE]);

    expectError(
      await graphql(
        CREATE_ROLE,
        { orgId, name: 'Assinatura', permissions: ['contracts:sign'] },
        'token-bruno',
      ),
      { code: 'FORBIDDEN', reason: 'PRIVILEGE_ESCALATION' },
    );
    expect(
      await ok(
        CREATE_ROLE,
        { orgId, name: 'Aprovação', permissions: [APPROVE] },
        'token-bruno',
      ),
    ).toMatchObject({ permissions: [APPROVE] });
  });

  it('o MEMBER de sistema pode receber permissão personalizada', async () => {
    await ok(
      CREATE_PERMISSION,
      { orgId, key: APPROVE, description: 'X' },
      'token-ana',
    );
    const memberRoleId = await systemRoleId(prisma, orgId, 'MEMBER');
    await seedMembership(prisma, { organizationId: orgId, userId: bruno.id });

    await ok(
      UPDATE_ROLE,
      { orgId, roleId: memberRoleId, permissions: [MEMBERS_READ, APPROVE] },
      'token-ana',
    );

    expect(await ok(MY_PERMISSIONS, { orgId }, 'token-bruno')).toEqual([
      MEMBERS_READ,
      APPROVE,
    ]);
  });
});
