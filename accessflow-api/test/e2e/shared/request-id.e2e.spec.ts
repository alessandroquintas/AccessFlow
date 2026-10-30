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
import { FakeMachineTokenVerifier } from '@test/fakes/identity/fake-machine-token-verifier';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';
import { seedOrganization } from '@test/factory/organizations/seed-organization';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const ME = '{ me { id } }';
const CREATE_ROLE = `mutation CreateRole($orgId: ID!, $name: String!) {
  createRole(organizationId: $orgId, input: { name: $name, permissions: ["members:read"] }) { id }
}`;

let app: INestApplication;
let prisma: PrismaService;
let tokens: FakeTokenVerifier;
let machines: FakeMachineTokenVerifier;
let orgId: string;
let anaId: string;

function graphql(
  query: string,
  variables: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return request(app.getHttpServer())
    .post('/graphql')
    .set({ 'Content-Type': 'application/json', ...headers })
    .send({ query, variables });
}

function getMember(headers: Record<string, string> = {}) {
  return request(app.getHttpServer())
    .get(`/v1/organizations/${orgId}/members/${anaId}`)
    .set(headers);
}

const asAna = (requestId?: string) => ({
  Authorization: 'Bearer token-ana',
  ...(requestId && { 'X-Request-Id': requestId }),
});

const asMachine = (requestId?: string) => ({
  Authorization: 'Bearer token-acme',
  ...(requestId && { 'X-Request-Id': requestId }),
});

/** Espera `count` sessões bloqueadas em trava no banco de testes. */
async function waitForLockWaiters(count: number, timeoutMs = 5000) {
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

describe('X-Request-Id (e2e)', () => {
  beforeAll(async () => {
    tokens = new FakeTokenVerifier();
    machines = new FakeMachineTokenVerifier();
    app = await createTestApp(tokens, undefined, machines);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    tokens.reset();
    machines.reset();
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "integration_clients", "memberships", "organizations", "users" CASCADE`;

    const ana = await prisma.user.create({
      data: { cognitoSub: 'ana', name: 'Ana', email: 'ana@example.com' },
    });
    anaId = ana.id;
    tokens.register('token-ana', { sub: 'ana' });
    ({ id: orgId } = await seedOrganization(prisma, {
      slug: 'acme',
      owner: anaId,
    }));
    await prisma.integrationClient.create({
      data: {
        clientId: 'client-acme',
        organizationId: orgId,
        name: 'ERP',
        scopes: Object.values(MachineScope),
      },
    });
    machines.register('token-acme', {
      clientId: 'client-acme',
      scopes: [MachineScope.MEMBERS_READ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('id do cliente', () => {
    it('válido é ecoado, no REST e no /graphql', async () => {
      const rest = await getMember(asMachine('erp.pedido-42_a'));
      const gql = await graphql(
        ME,
        {},
        asAna('3f6c1a52-9b7e-4d1f-8a2b-0c9d8e7f6a5b'),
      );

      expect(rest.status).toBe(200);
      expect(rest.headers['x-request-id']).toBe('erp.pedido-42_a');
      expect(gql.body.errors).toBeUndefined();
      expect(gql.headers['x-request-id']).toBe(
        '3f6c1a52-9b7e-4d1f-8a2b-0c9d8e7f6a5b',
      );
    });

    it.each([
      ['com espaço', 'pedido 12345678'],
      ['com tabulação', 'pedido-1234\t5678'],
      ['com 65 caracteres', 'a'.repeat(65)],
      ['com 7 caracteres', 'abc1234'],
      ['com quebra de linha codificada', 'pedido-1234%0A5678'],
    ])('%s é trocado por um UUID novo', async (_, invalid) => {
      const rest = await getMember(asMachine(invalid));
      const gql = await graphql(ME, {}, asAna(invalid));

      for (const res of [rest, gql]) {
        expect(res.headers['x-request-id']).toMatch(UUID);
      }
      expect(rest.headers['x-request-id']).not.toBe(
        gql.headers['x-request-id'],
      );
    });

    it('ausente: cada resposta recebe um UUID diferente', async () => {
      const [first, second] = [
        await getMember(asMachine()),
        await getMember(asMachine()),
      ];

      expect(first.headers['x-request-id']).toMatch(UUID);
      expect(second.headers['x-request-id']).toMatch(UUID);
      expect(first.headers['x-request-id']).not.toBe(
        second.headers['x-request-id'],
      );
    });
  });

  describe('respostas de erro também levam o cabeçalho', () => {
    it.each([
      ['401 sem token', 401, (id: string) => getMember({ 'X-Request-Id': id })],
      [
        '404 de rota inexistente',
        404,
        (id: string) =>
          request(app.getHttpServer())
            .get('/rota-inexistente')
            .set('X-Request-Id', id),
      ],
      [
        '400 INVALID_JSON (erro antes do middleware)',
        400,
        (id: string) =>
          request(app.getHttpServer())
            .post('/v1/authorize')
            .set({ 'Content-Type': 'application/json', 'X-Request-Id': id })
            .send('{oops'),
      ],
    ])('%s', async (_, status, send) => {
      const res = await send('erro-http-abc');

      expect(res.status).toBe(status);
      expect(res.headers['x-request-id']).toBe('erro-http-abc');
    });

    it('400 INVALID_JSON sem id do cliente: UUID gerado, corpo no formato de sempre', async () => {
      const res = await request(app.getHttpServer())
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send('{oops');

      expect(res.status).toBe(400);
      expect(res.headers['x-request-id']).toMatch(UUID);
      expect(res.body).toEqual({
        error: {
          code: 'BAD_REQUEST',
          reason: 'INVALID_JSON',
          message: 'O corpo da requisição não é um JSON válido.',
        },
      });
    });

    it('erro de domínio no GraphQL: cabeçalho, sem requestId nas extensions', async () => {
      const res = await graphql(ME, {}, { 'X-Request-Id': 'erro-gql-abc' });

      expect(res.headers['x-request-id']).toBe('erro-gql-abc');
      expect(res.body.errors[0].extensions).toEqual({
        code: 'UNAUTHENTICATED',
        reason: 'INVALID_ACCESS_TOKEN',
      });
    });
  });

  describe('500 mascarado', () => {
    let logError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logError = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
    });

    it('REST: o requestId do corpo é o do cabeçalho e o do log', async () => {
      const failure = new Error('falha interna com detalhe sensível');
      machines.failWith(failure);

      const res = await getMember(asMachine());

      const requestId = res.headers['x-request-id'];
      expect(requestId).toMatch(UUID);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro interno do servidor.',
          requestId,
        },
      });
      expect(JSON.stringify(res.body)).not.toContain('sensível');
      expect(logError).toHaveBeenCalledWith(`requestId=${requestId}`, failure);
    });

    it('GraphQL: o requestId vai nas extensions, e o do cliente é respeitado', async () => {
      const failure = new Error('falha interna com detalhe sensível');
      tokens.failWith(failure);

      const res = await graphql(ME, {}, asAna('cliente-500-abc'));

      expect(res.headers['x-request-id']).toBe('cliente-500-abc');
      expect(res.body.errors[0]).toEqual({
        message: 'Erro interno do servidor.',
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
          requestId: 'cliente-500-abc',
        },
      });
      expect(JSON.stringify(res.body)).not.toContain('sensível');
      expect(logError).toHaveBeenCalledWith(
        'requestId=cliente-500-abc',
        failure,
      );
    });
  });

  describe('trilha de auditoria', () => {
    async function requestIdOfRoleCreated(name: string) {
      const event = await prisma.auditEvent.findFirstOrThrow({
        where: {
          action: 'role.created',
          details: { path: ['name'], equals: name },
        },
      });
      return event.requestId;
    }

    it('o evento grava o id da requisição: o do cliente ou o gerado', async () => {
      const fromClient = await graphql(
        CREATE_ROLE,
        { orgId, name: 'Financeiro' },
        asAna('auditoria-abc-1'),
      );
      const generated = await graphql(
        CREATE_ROLE,
        { orgId, name: 'Compras' },
        asAna(),
      );

      expect(fromClient.body.errors).toBeUndefined();
      expect(generated.body.errors).toBeUndefined();
      expect(await requestIdOfRoleCreated('Financeiro')).toBe(
        'auditoria-abc-1',
      );
      expect(await requestIdOfRoleCreated('Compras')).toBe(
        generated.headers['x-request-id'],
      );
      expect(generated.headers['x-request-id']).toMatch(UUID);
    });

    it('a query auditEvents expõe o requestId de cada evento', async () => {
      await graphql(
        CREATE_ROLE,
        { orgId, name: 'Financeiro' },
        asAna('trilha-abc-01'),
      );

      const res = await graphql(
        `
          query Audit($orgId: ID!) {
            auditEvents(organizationId: $orgId) {
              nodes {
                action
                requestId
              }
            }
          }
        `,
        { orgId },
        asAna(),
      );

      expect(res.body.data.auditEvents.nodes).toEqual([
        { action: 'role.created', requestId: 'trilha-abc-01' },
      ]);
    });

    it('duas requisições concorrentes não trocam de id', async () => {
      let pending!: Promise<request.Response[]>;

      // Trava a organização e só a solta com as duas criações esperando
      // nela: as duas ficam em andamento ao mesmo tempo e terminam juntas.
      await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId}::uuid FOR UPDATE`;

          pending = Promise.all([
            graphql(
              CREATE_ROLE,
              { orgId, name: 'Papel A' },
              asAna('concorrente-a'),
            ),
            graphql(
              CREATE_ROLE,
              { orgId, name: 'Papel B' },
              asAna('concorrente-b'),
            ),
          ]);
          await waitForLockWaiters(2);
        },
        { timeout: 10_000 },
      );
      const [a, b] = await pending;

      expect(a.body.errors).toBeUndefined();
      expect(b.body.errors).toBeUndefined();
      expect([a.headers['x-request-id'], b.headers['x-request-id']]).toEqual([
        'concorrente-a',
        'concorrente-b',
      ]);
      expect(await requestIdOfRoleCreated('Papel A')).toBe('concorrente-a');
      expect(await requestIdOfRoleCreated('Papel B')).toBe('concorrente-b');
    });
  });
});
