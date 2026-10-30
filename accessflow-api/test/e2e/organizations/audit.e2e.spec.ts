import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { AuditAction } from '@/modules/organizations/domain/entities/audit-event.entity';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { FakeIdentityProfileProvider } from '@test/fakes/identity/fake-identity-profile-provider';
import { FakeMachineTokenVerifier } from '@test/fakes/identity/fake-machine-token-verifier';
import { FixedClock } from '@test/fakes/shared/fixed-clock';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';
import { systemRoleId } from '@test/factory/organizations/seed-organization';

const START = new Date('2026-03-01T12:00:00.000Z');

const AUDIT_EVENTS = `query Audit($orgId: ID!, $first: Int, $after: String, $filter: AuditEventFilter) {
  auditEvents(organizationId: $orgId, first: $first, after: $after, filter: $filter) {
    nodes {
      id action occurredAt details
      actor { type userId name clientId }
      target { type id }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

interface AuditNode {
  id: string;
  action: string;
  occurredAt: string;
  details: string;
  actor: {
    type: string;
    userId: string | null;
    name: string | null;
    clientId: string | null;
  };
  target: { type: string; id: string };
}

let app: INestApplication;
let prisma: PrismaService;
let tokens: FakeTokenVerifier;
let profiles: FakeIdentityProfileProvider;
let clock: FixedClock;

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

/** Resposta sem erro: devolve `data[field]`. Avança o relógio 1 s antes. */
async function ok<T = any>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
): Promise<T> {
  clock.advance(1000);
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
  return ok<{ id: string }>(
    `mutation P($name: String!) { provisionMe(input: { name: $name }) { id } }`,
    { name },
    `token-${sub}`,
  );
}

describe('Trilha de auditoria (e2e)', () => {
  let ana: { id: string };
  let bruno: { id: string };
  let orgId: string;

  beforeAll(async () => {
    tokens = new FakeTokenVerifier();
    profiles = new FakeIdentityProfileProvider();
    clock = new FixedClock(START);
    app = await createTestApp(
      tokens,
      profiles,
      new FakeMachineTokenVerifier(),
      clock,
    );
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    tokens.reset();
    profiles.reset();
    clock.set(START);
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "memberships", "organizations", "users" CASCADE`;

    ana = await provision('ana', 'Ana');
    bruno = await provision('bruno', 'Bruno');
    await provision('carla', 'Carla');
    await provision('davi', 'Davi');
    await provision('eva', 'Eva');
  });

  async function audit(
    variables: { first?: number; after?: string; filter?: object } = {},
    token = 'token-ana',
    organizationId = orgId,
  ) {
    return ok<{
      nodes: AuditNode[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    }>(AUDIT_EVENTS, { orgId: organizationId, first: 50, ...variables }, token);
  }

  /**
   * Fluxo administrativo com as 18 ações, um passo por segundo. Devolve os
   * ids que os testes usam.
   */
  async function runFlow() {
    const as = (sub: string) => `token-${sub}`;
    ({ id: orgId } = await ok(
      `mutation { createOrganization(input: { name: "Acme", slug: "acme" }) { id } }`,
      {},
      as('ana'),
    ));
    await ok(
      `mutation U($orgId: ID!) { updateOrganization(organizationId: $orgId, input: { name: "Acme SA" }) { id } }`,
      { orgId },
      as('ana'),
    );
    await ok(
      `mutation C($orgId: ID!) { createPermission(organizationId: $orgId, input: { key: "invoices:approve", description: "Aprovar" }) { key } }`,
      { orgId },
      as('ana'),
    );
    await ok(
      `mutation U($orgId: ID!) { updatePermission(organizationId: $orgId, input: { key: "invoices:approve", description: "Aprovar faturas" }) { key } }`,
      { orgId },
      as('ana'),
    );
    const { id: financeId } = await ok(
      `mutation R($orgId: ID!) { createRole(organizationId: $orgId, input: { name: "Financeiro", permissions: ["members:read", "invoices:approve"] }) { id } }`,
      { orgId },
      as('ana'),
    );
    const invite = (email: string, choice: object) =>
      ok<{ id: string }>(
        `mutation I($orgId: ID!, $email: String!, $role: MembershipRole, $roleId: ID) {
          inviteMember(organizationId: $orgId, input: { email: $email, role: $role, roleId: $roleId }) { id }
        }`,
        { orgId, email, ...choice },
        as('ana'),
      );
    const accept = (sub: string, id: string) =>
      ok(
        `mutation A($id: ID!) { acceptInvitation(invitationId: $id) { id } }`,
        { id },
        as(sub),
      );
    const { id: brunoInvitation } = await invite('bruno@example.com', {
      roleId: financeId,
    });
    await invite('bruno@example.com', { role: 'MEMBER' }); // renova
    await accept('bruno', brunoInvitation);
    const memberRoleId = await systemRoleId(prisma, orgId, 'MEMBER');
    await ok(
      `mutation A($orgId: ID!, $userId: ID!, $roleId: ID!) { assignRole(organizationId: $orgId, input: { userId: $userId, roleId: $roleId }) { userId } }`,
      { orgId, userId: bruno.id, roleId: financeId },
      as('ana'),
    );
    await ok(
      `mutation U($orgId: ID!, $roleId: ID!) { updateRole(organizationId: $orgId, input: { roleId: $roleId, permissions: ["members:read"] }) { id } }`,
      { orgId, roleId: financeId },
      as('ana'),
    );
    const { id: carlaInvitation } = await invite('carla@example.com', {
      role: 'MEMBER',
    });
    await ok(
      `mutation D($id: ID!) { declineInvitation(invitationId: $id) }`,
      { id: carlaInvitation },
      as('carla'),
    );
    const { id: daviInvitation } = await invite('davi@example.com', {
      role: 'MEMBER',
    });
    await ok(
      `mutation R($orgId: ID!, $id: ID!) { revokeInvitation(organizationId: $orgId, invitationId: $id) }`,
      { orgId, id: daviInvitation },
      as('ana'),
    );
    await ok(
      `mutation L($orgId: ID!) { leaveOrganization(organizationId: $orgId) }`,
      { orgId },
      as('bruno'),
    );
    await ok(
      `mutation D($orgId: ID!, $roleId: ID!) { deleteRole(organizationId: $orgId, roleId: $roleId) }`,
      { orgId, roleId: financeId },
      as('ana'),
    );
    await ok(
      `mutation D($orgId: ID!) { deletePermission(organizationId: $orgId, key: "invoices:approve") }`,
      { orgId },
      as('ana'),
    );
    const { id: evaInvitation } = await invite('eva@example.com', {
      role: 'MEMBER',
    });
    await accept('eva', evaInvitation);
    const eva = await prisma.user.findFirstOrThrow({
      where: { cognitoSub: 'eva' },
    });
    await ok(
      `mutation R($orgId: ID!, $userId: ID!) { removeMember(organizationId: $orgId, userId: $userId) }`,
      { orgId, userId: eva.id },
      as('ana'),
    );
    const { integration } = await ok<{
      integration: { id: string; clientId: string };
    }>(
      `mutation C($orgId: ID!) { createIntegrationClient(organizationId: $orgId, input: { name: "ERP", scopes: ["accessflow-api/members.read"] }) { integration { id clientId } } }`,
      { orgId },
      as('ana'),
    );
    await ok(
      `mutation R($orgId: ID!, $id: ID!) { revokeIntegrationClient(organizationId: $orgId, integrationId: $id) }`,
      { orgId, id: integration.id },
      as('ana'),
    );
    return {
      financeId,
      memberRoleId,
      brunoInvitation,
      evaId: eva.id,
      integration,
    };
  }

  /** As ações do fluxo, da mais antiga para a mais recente. */
  const FLOW = [
    'organization.created',
    'organization.updated',
    'permission.created',
    'permission.updated',
    'role.created',
    'invitation.created',
    'invitation.renewed',
    'invitation.accepted',
    'member.role_changed',
    'role.updated',
    'invitation.created',
    'invitation.declined',
    'invitation.created',
    'invitation.revoked',
    'member.left',
    'role.deleted',
    'permission.deleted',
    'invitation.created',
    'invitation.accepted',
    'member.removed',
    'integration.created',
    'integration.revoked',
  ];

  it('o fluxo administrativo gera a trilha esperada, do mais recente para o mais antigo', async () => {
    const { financeId, memberRoleId, brunoInvitation, integration } =
      await runFlow();

    const { nodes, pageInfo } = await audit();

    expect(nodes.map((n) => n.action)).toEqual([...FLOW].reverse());
    expect(new Set(nodes.map((n) => n.action))).toEqual(
      new Set(Object.values(AuditAction)),
    );
    expect(pageInfo).toEqual({
      hasNextPage: false,
      endCursor: expect.any(String),
    });

    // Ator, nome e alvo de alguns eventos; details é JSON de um objeto.
    const byAction = (action: string) =>
      nodes.filter((n) => n.action === action);
    const [accepted] = byAction('invitation.accepted').reverse();
    expect(accepted).toMatchObject({
      actor: { type: 'USER', userId: bruno.id, name: 'Bruno', clientId: null },
      target: { type: 'invitation', id: brunoInvitation },
    });
    expect(JSON.parse(accepted.details)).toEqual({
      roleId: memberRoleId,
      memberUserId: bruno.id,
      membership: 'created',
    });
    expect(JSON.parse(byAction('invitation.renewed')[0].details)).toEqual({
      roleId: memberRoleId,
      previousRoleId: financeId,
    });
    expect(byAction('role.updated')[0]).toMatchObject({
      actor: { userId: ana.id, name: 'Ana' },
      target: { type: 'role', id: financeId },
    });
    expect(JSON.parse(byAction('role.updated')[0].details)).toEqual({
      changes: { permissionsRemoved: ['invoices:approve'] },
    });
    expect(byAction('permission.deleted')[0].target).toEqual({
      type: 'permission',
      id: 'invoices:approve',
    });
    const [created] = byAction('integration.created');
    expect(created).toMatchObject({
      actor: { type: 'USER', userId: ana.id, name: 'Ana', clientId: null },
      target: { type: 'integration', id: integration.id },
    });
    expect(JSON.parse(created.details)).toEqual({
      name: 'ERP',
      scopes: ['accessflow-api/members.read'],
      clientId: integration.clientId,
    });
    expect(JSON.parse(byAction('integration.revoked')[0].details)).toEqual({
      clientId: integration.clientId,
    });
    expect(nodes.map((n) => n.occurredAt)).toEqual(
      [...nodes.map((n) => n.occurredAt)].sort().reverse(),
    );

    // Varredura: nenhum details com e-mail.
    expect(nodes.filter((n) => n.details.includes('@'))).toEqual([]);
  });

  it('pagina em duas páginas, sem repetir nem perder eventos', async () => {
    await runFlow();

    const first = await audit({ first: 12 });
    const second = await audit({ first: 12, after: first.pageInfo.endCursor! });

    expect(first.nodes).toHaveLength(12);
    expect(first.pageInfo.hasNextPage).toBe(true);
    expect(second.nodes).toHaveLength(FLOW.length - 12);
    expect(second.pageInfo.hasNextPage).toBe(false);
    expect([...first.nodes, ...second.nodes].map((n) => n.action)).toEqual(
      [...FLOW].reverse(),
    );
  });

  describe('filtros', () => {
    let ids: Awaited<ReturnType<typeof runFlow>>;

    beforeEach(async () => {
      ids = await runFlow();
    });

    const actions = async (filter: object) =>
      (await audit({ filter })).nodes.map((n) => n.action);

    it('actions', async () => {
      expect(
        await actions({ actions: ['invitation.accepted', 'member.left'] }),
      ).toEqual(['invitation.accepted', 'member.left', 'invitation.accepted']);
    });

    it('actorUserId: só o que o Bruno fez', async () => {
      expect(await actions({ actorUserId: bruno.id.toUpperCase() })).toEqual([
        'member.left',
        'invitation.accepted',
      ]);
    });

    it('targetType e targetId: a história de um papel', async () => {
      expect(
        await actions({ targetType: 'role', targetId: ids.financeId }),
      ).toEqual(['role.deleted', 'role.updated', 'role.created']);
    });

    it('occurredFrom e occurredTo, inclusivos', async () => {
      const all = (await audit()).nodes.reverse();
      const [from, to] = [all[2].occurredAt, all[4].occurredAt];

      expect(await actions({ occurredFrom: from, occurredTo: to })).toEqual([
        'role.created',
        'permission.updated',
        'permission.created',
      ]);
    });

    it('ação desconhecida ou período invertido: BAD_REQUEST', async () => {
      const invalid = { code: 'BAD_REQUEST', reason: 'INVALID_AUDIT_FILTER' };

      for (const filter of [
        { actions: ['role.renamed'] },
        {
          occurredFrom: '2026-03-02T00:00:00.000Z',
          occurredTo: '2026-03-01T00:00:00.000Z',
        },
      ]) {
        expectError(
          await graphql(AUDIT_EVENTS, { orgId, filter }, 'token-ana'),
          invalid,
        );
      }
    });
  });

  describe('acesso', () => {
    beforeEach(async () => {
      ({ id: orgId } = await ok(
        `mutation { createOrganization(input: { name: "Acme", slug: "acme" }) { id } }`,
        {},
        'token-ana',
      ));
      const { id: invitationId } = await ok<{ id: string }>(
        `mutation I($orgId: ID!) { inviteMember(organizationId: $orgId, input: { email: "bruno@example.com", role: MEMBER }) { id } }`,
        { orgId },
        'token-ana',
      );
      await ok(
        `mutation A($id: ID!) { acceptInvitation(invitationId: $id) { id } }`,
        { id: invitationId },
        'token-bruno',
      );
    });

    it('MEMBER sem audit:read recebe FORBIDDEN; com a permissão concedida, lê', async () => {
      expectError(await graphql(AUDIT_EVENTS, { orgId }, 'token-bruno'), {
        code: 'FORBIDDEN',
        reason: 'ORGANIZATION_PERMISSION_DENIED',
      });

      await ok(
        `mutation U($orgId: ID!, $roleId: ID!) { updateRole(organizationId: $orgId, input: { roleId: $roleId, permissions: ["members:read", "audit:read"] }) { id } }`,
        { orgId, roleId: await systemRoleId(prisma, orgId, 'MEMBER') },
        'token-ana',
      );

      const { nodes } = await audit({}, 'token-bruno');
      expect(nodes.map((n) => n.action)).toEqual([
        'role.updated',
        'invitation.accepted',
        'invitation.created',
        'organization.created',
      ]);
    });

    it('não membro recebe NOT_FOUND', async () => {
      expectError(await graphql(AUDIT_EVENTS, { orgId }, 'token-carla'), {
        code: 'NOT_FOUND',
        reason: 'ORGANIZATION_NOT_FOUND',
      });
    });

    it('a trilha de outra organização não aparece e não pode ser lida', async () => {
      const { id: betaId } = await ok<{ id: string }>(
        `mutation { createOrganization(input: { name: "Beta", slug: "beta" }) { id } }`,
        {},
        'token-carla',
      );

      // A trilha da Acme continua só com os três eventos dela.
      const acme = (await audit()).nodes;
      expect(acme.map((n) => n.action)).toEqual([
        'invitation.accepted',
        'invitation.created',
        'organization.created',
      ]);
      expect(acme.every((n) => n.target.id !== betaId)).toBe(true);
      expectError(await graphql(AUDIT_EVENTS, { orgId: betaId }, 'token-ana'), {
        code: 'NOT_FOUND',
        reason: 'ORGANIZATION_NOT_FOUND',
      });
      expect(
        (await audit({}, 'token-carla', betaId)).nodes.map((n) => n.action),
      ).toEqual(['organization.created']);
    });
  });
});
