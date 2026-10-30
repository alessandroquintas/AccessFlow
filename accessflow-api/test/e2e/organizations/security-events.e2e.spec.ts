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
import { Logger, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { MachineScope } from '@/shared/domain/machine-scope';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { FakeIdentityProfileProvider } from '@test/fakes/identity/fake-identity-profile-provider';
import { FakeMachineTokenVerifier } from '@test/fakes/identity/fake-machine-token-verifier';
import { FixedClock } from '@test/fakes/shared/fixed-clock';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';
import {
  seedMembership,
  seedOrganization,
  seedRole,
} from '@test/factory/organizations/seed-organization';

const START = new Date('2026-03-01T12:00:00.000Z');
const at = (seconds: number) =>
  new Date(START.getTime() + seconds * 1000).toISOString();

const MEMBERS_ROUTE = 'GET /v1/organizations/:organizationId/members/:userId';

const CREATE_ROLE = `mutation CreateRole($orgId: ID!, $input: CreateRoleInput!) {
  createRole(organizationId: $orgId, input: $input) { id }
}`;
const SECURITY_EVENTS = `query SecurityEvents($orgId: ID!, $first: Int, $after: String, $filter: SecurityEventFilter) {
  securityEvents(organizationId: $orgId, first: $first, after: $after, filter: $filter) {
    nodes {
      id event occurredAt details requestId
      actor { type userId name clientId }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

interface SecurityEventNode {
  id: string;
  event: string;
  occurredAt: string;
  details: string;
  requestId: string | null;
  actor: {
    type: string;
    userId: string | null;
    name: string | null;
    clientId: string | null;
  };
}

let app: INestApplication;
let prisma: PrismaService;
let tokens: FakeTokenVerifier;
let machines: FakeMachineTokenVerifier;
let clock: FixedClock;

const users: Record<string, string> = {};
let acmeId: string;
let betaId: string;

function graphql(
  query: string,
  variables: Record<string, unknown>,
  token?: string,
) {
  const req = request(app.getHttpServer())
    .post('/graphql')
    .set('Content-Type', 'application/json');
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send({ query, variables });
}

/** Avança o relógio um segundo antes, para os eventos terem ordem. */
function createRole(token: string, permissions: string[], name = 'Novo') {
  clock.advance(1000);
  return graphql(
    CREATE_ROLE,
    { orgId: acmeId, input: { name, permissions } },
    token,
  );
}

function getMember(token: string | undefined, organizationId = acmeId) {
  clock.advance(1000);
  const req = request(app.getHttpServer()).get(
    `/v1/organizations/${organizationId}/members/${users.ana}`,
  );
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req;
}

function authorize(token: string, body: object) {
  clock.advance(1000);
  return request(app.getHttpServer())
    .post('/v1/authorize')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

/** As linhas da tabela, sem o id. */
function rows() {
  return prisma.securityEvent.findMany({
    select: {
      organizationId: true,
      actorType: true,
      actorUserId: true,
      actorClientId: true,
      event: true,
      details: true,
      requestId: true,
      occurredAt: true,
    },
    orderBy: { occurredAt: 'asc' },
  });
}

async function securityEvents(
  variables: { first?: number; after?: string; filter?: object } = {},
  token = 'token-ana',
  organizationId = acmeId,
) {
  const res = await graphql(
    SECURITY_EVENTS,
    { orgId: organizationId, first: 50, ...variables },
    token,
  );
  expect(res.body.errors).toBeUndefined();
  return res.body.data.securityEvents as {
    nodes: SecurityEventNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

async function createUser(sub: string, name: string) {
  tokens.register(`token-${sub}`, { sub });
  const user = await prisma.user.create({
    data: { cognitoSub: sub, name, email: `${sub}@example.com` },
  });
  users[sub] = user.id;
}

async function addClient(
  clientId: string,
  organizationId: string | null,
  scopes: MachineScope[],
  status: 'ACTIVE' | 'REVOKED' = 'ACTIVE',
) {
  if (organizationId) {
    await prisma.integrationClient.create({
      data: {
        clientId,
        organizationId,
        name: clientId,
        scopes: Object.values(MachineScope),
        status,
        revokedAt: status === 'REVOKED' ? new Date() : null,
      },
    });
  }
  machines.register(`token-${clientId}`, { clientId, scopes });
}

describe('Eventos de segurança (e2e)', () => {
  beforeAll(async () => {
    tokens = new FakeTokenVerifier();
    machines = new FakeMachineTokenVerifier();
    clock = new FixedClock(START);
    app = await createTestApp(
      tokens,
      new FakeIdentityProfileProvider(),
      machines,
      clock,
    );
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    tokens.reset();
    machines.reset();
    clock.set(START);
    // Sem FK, o CASCADE das organizações não alcança security_events.
    await prisma.$executeRaw`TRUNCATE TABLE "security_events", "authorization_decisions", "invitations", "integration_clients", "memberships", "organizations", "users" CASCADE`;

    for (const [sub, name] of [
      ['ana', 'Ana'],
      ['bruno', 'Bruno'],
      ['carla', 'Carla'],
      ['eva', 'Eva'],
      ['fabio', 'Fábio'],
    ]) {
      await createUser(sub, name);
    }
    acmeId = (
      await seedOrganization(prisma, { slug: 'acme', owner: users.ana })
    ).id;
    betaId = (
      await seedOrganization(prisma, { slug: 'beta', owner: users.fabio })
    ).id;
    // Bruno: MEMBER, sem roles:manage. Carla: gerencia papéis, mas não
    // remove membros.
    await seedMembership(prisma, {
      organizationId: acmeId,
      userId: users.bruno,
    });
    await seedMembership(prisma, {
      organizationId: acmeId,
      userId: users.carla,
      roleId: await seedRole(prisma, {
        organizationId: acmeId,
        name: 'Gestor',
        permissions: ['members:read', 'roles:read', 'roles:manage'],
      }),
    });

    const all = [MachineScope.AUTHORIZE, MachineScope.MEMBERS_READ];
    await addClient('client-acme', acmeId, all);
    await addClient('client-sem-escopo', acmeId, []);
    await addClient('client-revogado', acmeId, all, 'REVOKED');
    await addClient('client-beta', betaId, all);
    // Token válido no Cognito, mas sem cadastro aqui.
    await addClient('client-fantasma', null, all);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('cada evento no seu cenário', () => {
    it('access.forbidden: membro sem a permissão, com a operação e a permissão', async () => {
      const res = await createRole('token-bruno', ['members:read']);

      expect(res.body.errors[0].extensions).toEqual({
        code: 'FORBIDDEN',
        reason: 'ORGANIZATION_PERMISSION_DENIED',
      });
      expect(await rows()).toEqual([
        {
          organizationId: acmeId,
          actorType: 'USER',
          actorUserId: users.bruno,
          actorClientId: null,
          event: 'access.forbidden',
          details: { operation: 'createRole', permission: 'roles:manage' },
          requestId: res.headers['x-request-id'],
          occurredAt: new Date(at(1)),
        },
      ]);
    });

    it('access.privilege_escalation: conceder permissão que não tem', async () => {
      const res = await createRole('token-carla', ['members:remove']);

      expect(res.body.errors[0].extensions.reason).toBe('PRIVILEGE_ESCALATION');
      expect(await rows()).toEqual([
        expect.objectContaining({
          organizationId: acmeId,
          actorType: 'USER',
          actorUserId: users.carla,
          event: 'access.privilege_escalation',
          details: { operation: 'createRole' },
          requestId: res.headers['x-request-id'],
        }),
      ]);
    });

    it('machine.scope_denied: a rota declarada e os escopos exigidos, na organização do client', async () => {
      const members = await getMember('token-client-sem-escopo');
      const authz = await authorize('token-client-sem-escopo', {
        organizationId: acmeId,
        userId: users.ana,
        permissions: ['members:read'],
      });

      expect([members.status, authz.status]).toEqual([403, 403]);
      expect(await rows()).toEqual([
        expect.objectContaining({
          organizationId: acmeId,
          actorType: 'MACHINE',
          actorUserId: null,
          actorClientId: 'client-sem-escopo',
          event: 'machine.scope_denied',
          details: {
            route: MEMBERS_ROUTE,
            requiredScopes: [MachineScope.MEMBERS_READ],
          },
          requestId: members.headers['x-request-id'],
        }),
        expect.objectContaining({
          actorClientId: 'client-sem-escopo',
          details: {
            route: 'POST /v1/authorize',
            requiredScopes: [MachineScope.AUTHORIZE],
          },
          requestId: authz.headers['x-request-id'],
        }),
      ]);
    });

    it('machine.organization_denied: client pedindo outra organização fica na dele, nunca na pedida', async () => {
      const members = await getMember('token-client-acme', betaId);
      const authz = await authorize('token-client-acme', {
        organizationId: betaId,
        userId: users.fabio,
        permissions: ['members:read'],
      });

      expect([members.status, authz.status]).toEqual([404, 404]);
      expect(await rows()).toEqual([
        expect.objectContaining({
          organizationId: acmeId,
          actorClientId: 'client-acme',
          event: 'machine.organization_denied',
          details: { route: MEMBERS_ROUTE },
        }),
        expect.objectContaining({
          organizationId: acmeId,
          actorClientId: 'client-acme',
          event: 'machine.organization_denied',
          details: { route: 'POST /v1/authorize' },
        }),
      ]);
      expect((await securityEvents({}, 'token-fabio', betaId)).nodes).toEqual(
        [],
      );
    });

    it('machine.organization_denied: client revogado fica na organização em que foi cadastrado; não cadastrado, em nenhuma', async () => {
      const revoked = await getMember('token-client-revogado');
      const ghost = await getMember('token-client-fantasma');

      expect([revoked.status, ghost.status]).toEqual([404, 404]);
      expect(
        (await rows()).map((r) => [r.actorClientId, r.organizationId, r.event]),
      ).toEqual([
        ['client-revogado', acmeId, 'machine.organization_denied'],
        ['client-fantasma', null, 'machine.organization_denied'],
      ]);
    });
  });

  it.each([
    [
      'não membro recebendo NOT_FOUND',
      () => createRole('token-eva', ['members:read']),
      'ORGANIZATION_NOT_FOUND',
    ],
    [
      '400 de validação no GraphQL',
      () => createRole('token-ana', ['members:read'], ''),
      'INVALID_ROLE',
    ],
    [
      '401 no GraphQL',
      () =>
        graphql(CREATE_ROLE, {
          orgId: acmeId,
          input: { name: 'X', permissions: [] },
        }),
      'INVALID_ACCESS_TOKEN',
    ],
  ])('nada é gravado: %s', async (_, send, reason) => {
    const res = await send();

    expect(res.body.errors[0].extensions.reason).toBe(reason);
    expect(await prisma.securityEvent.count()).toBe(0);
  });

  it.each([
    [
      '400 de validação no authorize',
      () =>
        authorize('token-client-acme', {
          organizationId: acmeId,
          userId: 'nao-e-uuid',
          permissions: ['members:read'],
        }),
      400,
    ],
    ['401 sem token', () => getMember(undefined), 401],
    ['200', () => getMember('token-client-acme'), 200],
  ])('nada é gravado: %s', async (_, send, status) => {
    expect((await send()).status).toBe(status);
    expect(await prisma.securityEvent.count()).toBe(0);
  });

  it('negação dentro da transação que travou a organização: resposta em menos de 1 s, evento gravado e a ação desfeita', async () => {
    // O createRole trava a organização (FOR UPDATE) antes de checar a
    // permissão; a negação desfaz a transação inteira.
    const started = Date.now();
    const res = await createRole('token-bruno', ['members:read'], 'Negado');
    const elapsed = Date.now() - started;

    expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
    expect(elapsed).toBeLessThan(1000);
    expect((await rows()).map((r) => r.event)).toEqual(['access.forbidden']);
    expect(await prisma.role.count({ where: { name: 'Negado' } })).toBe(0);
    expect(
      await prisma.auditEvent.count({ where: { action: 'role.created' } }),
    ).toBe(0);
  });

  it('falha ao gravar o evento: a negação responde igual, e o log leva o requestId', async () => {
    const logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const before = await createRole('token-bruno', ['members:read']);
    await prisma.$executeRaw`TRUNCATE TABLE "security_events"`;
    // Falha de verdade no banco, só durante este teste.
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION test_fail_security_event() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'gravação recusada no teste'; END $$`);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER test_fail_security_event BEFORE INSERT ON security_events
      FOR EACH ROW EXECUTE FUNCTION test_fail_security_event()`);
    try {
      const rest = await getMember('token-client-sem-escopo');
      const gql = await createRole('token-bruno', ['members:read']);

      expect(rest.status).toBe(403);
      expect(rest.body.error.reason).toBe('INSUFFICIENT_SCOPE');
      expect(gql.body).toEqual(before.body);
      expect(await prisma.securityEvent.count()).toBe(0);
      expect(logError).toHaveBeenCalledWith(
        `Evento machine.scope_denied não gravado; requestId=${rest.headers['x-request-id']}`,
        expect.any(Error),
      );
      expect(logError).toHaveBeenCalledWith(
        `Evento access.forbidden não gravado; requestId=${gql.headers['x-request-id']}`,
        expect.any(Error),
      );
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER test_fail_security_event ON security_events',
      );
      await prisma.$executeRawUnsafe(
        'DROP FUNCTION test_fail_security_event()',
      );
    }
  });

  describe('securityEvents', () => {
    const requestIds: string[] = [];

    beforeEach(async () => {
      requestIds.length = 0;
      // Em ordem: Bruno negado, client sem escopo, Carla escalando, client
      // pedindo a Beta. Mais uma negação na Beta.
      for (const send of [
        () => createRole('token-bruno', ['members:read']),
        () => getMember('token-client-sem-escopo'),
        () => createRole('token-carla', ['members:remove']),
        () => getMember('token-client-acme', betaId),
      ]) {
        requestIds.push((await send()).headers['x-request-id']);
      }
      await getMember('token-client-beta', acmeId);
    });

    const events = (nodes: SecurityEventNode[]) => nodes.map((n) => n.event);

    it('do mais recente para o mais antigo, com ator, nome em lote, details e requestId', async () => {
      const { nodes, pageInfo } = await securityEvents();

      expect(pageInfo.hasNextPage).toBe(false);
      expect(nodes).toEqual([
        {
          id: expect.any(String),
          event: 'machine.organization_denied',
          occurredAt: at(4),
          details: JSON.stringify({ route: MEMBERS_ROUTE }),
          requestId: requestIds[3],
          actor: {
            type: 'MACHINE',
            userId: null,
            name: null,
            clientId: 'client-acme',
          },
        },
        expect.objectContaining({
          event: 'access.privilege_escalation',
          actor: {
            type: 'USER',
            userId: users.carla,
            name: 'Carla',
            clientId: null,
          },
          requestId: requestIds[2],
        }),
        expect.objectContaining({
          event: 'machine.scope_denied',
          actor: expect.objectContaining({ clientId: 'client-sem-escopo' }),
          requestId: requestIds[1],
        }),
        expect.objectContaining({
          event: 'access.forbidden',
          occurredAt: at(1),
          details: JSON.stringify({
            operation: 'createRole',
            permission: 'roles:manage',
          }),
          actor: {
            type: 'USER',
            userId: users.bruno,
            name: 'Bruno',
            clientId: null,
          },
          requestId: requestIds[0],
        }),
      ]);
      expect(nodes.filter((n) => n.details.includes('@'))).toEqual([]);
    });

    it('pagina pelo cursor sem repetir nem pular', async () => {
      const first = await securityEvents({ first: 3 });
      const second = await securityEvents({
        first: 3,
        after: first.pageInfo.endCursor!,
      });

      expect(first.nodes.map((n) => n.occurredAt)).toEqual([
        at(4),
        at(3),
        at(2),
      ]);
      expect(first.pageInfo.hasNextPage).toBe(true);
      expect(second.nodes.map((n) => n.occurredAt)).toEqual([at(1)]);
      expect(second.pageInfo.hasNextPage).toBe(false);
    });

    it('filtros, sozinhos e combinados', async () => {
      const by = async (filter: object) =>
        events((await securityEvents({ filter })).nodes);

      expect(
        await by({ events: ['access.forbidden', 'machine.scope_denied'] }),
      ).toEqual(['machine.scope_denied', 'access.forbidden']);
      expect(await by({ actorUserId: users.carla.toUpperCase() })).toEqual([
        'access.privilege_escalation',
      ]);
      expect(await by({ actorClientId: 'client-acme' })).toEqual([
        'machine.organization_denied',
      ]);
      expect(await by({ occurredFrom: at(2), occurredTo: at(3) })).toEqual([
        'access.privilege_escalation',
        'machine.scope_denied',
      ]);
    });

    it('filtro inválido: BAD_REQUEST INVALID_AUDIT_FILTER', async () => {
      for (const filter of [
        { events: ['access.denied'] },
        { actorUserId: 'ana' },
        { occurredFrom: at(3), occurredTo: at(2) },
      ]) {
        const res = await graphql(
          SECURITY_EVENTS,
          { orgId: acmeId, filter },
          'token-ana',
        );

        expect(res.body.errors[0].extensions).toEqual({
          code: 'BAD_REQUEST',
          reason: 'INVALID_AUDIT_FILTER',
        });
      }
    });

    it('membro sem audit:read: FORBIDDEN (e a negação vira evento); não membro: NOT_FOUND', async () => {
      const member = await graphql(
        SECURITY_EVENTS,
        { orgId: acmeId },
        'token-bruno',
      );
      const outsider = await graphql(
        SECURITY_EVENTS,
        { orgId: acmeId },
        'token-eva',
      );

      expect(member.body.errors[0].extensions).toEqual({
        code: 'FORBIDDEN',
        reason: 'ORGANIZATION_PERMISSION_DENIED',
      });
      expect(outsider.body.errors[0].extensions).toEqual({
        code: 'NOT_FOUND',
        reason: 'ORGANIZATION_NOT_FOUND',
      });
      expect((await securityEvents({ first: 1 })).nodes[0]).toMatchObject({
        event: 'access.forbidden',
        details: JSON.stringify({
          operation: 'securityEvents',
          permission: 'audit:read',
        }),
      });
    });

    it('outra organização é invisível: a da Beta não aparece na Acme, e a Beta é NOT_FOUND para quem é só da Acme', async () => {
      const acme = await securityEvents();
      const beta = await securityEvents({}, 'token-fabio', betaId);
      const crossed = await graphql(
        SECURITY_EVENTS,
        { orgId: betaId },
        'token-ana',
      );

      expect(acme.nodes.map((n) => n.actor.clientId)).not.toContain(
        'client-beta',
      );
      expect(
        beta.nodes.map((n) => [n.event, n.actor.clientId, n.details]),
      ).toEqual([
        [
          'machine.organization_denied',
          'client-beta',
          JSON.stringify({ route: MEMBERS_ROUTE }),
        ],
      ]);
      expect(crossed.body.errors[0].extensions).toEqual({
        code: 'NOT_FOUND',
        reason: 'ORGANIZATION_NOT_FOUND',
      });
    });
  });
});
