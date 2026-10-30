import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { Logger, LoggerService } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { MachineScope } from '@/shared/domain/machine-scope';
import { machineClientName } from '@/modules/organizations/application/ports/machine-client-provisioner.port';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { FakeIdentityProfileProvider } from '@test/fakes/identity/fake-identity-profile-provider';
import { FakeMachineTokenVerifier } from '@test/fakes/identity/fake-machine-token-verifier';
import {
  FAKE_SECRET_MARKER,
  FakeMachineClientProvisioner,
} from '@test/fakes/organizations/fake-machine-client-provisioner';
import { SystemClock } from '@/shared/infrastructure/clock/system-clock';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';
import {
  seedMembership,
  seedOrganization,
  seedRole,
} from '@test/factory/organizations/seed-organization';

const INTEGRATION_FIELDS = `id name clientId scopes status createdAt revokedAt createdBy { userId name }`;
const LIST = `query L($orgId: ID!) { integrationClients(organizationId: $orgId) { ${INTEGRATION_FIELDS} } }`;
const CREATE = `mutation C($orgId: ID!, $name: String!, $scopes: [String!]!) {
  createIntegrationClient(organizationId: $orgId, input: { name: $name, scopes: $scopes }) {
    clientSecret
    integration { ${INTEGRATION_FIELDS} }
  }
}`;
const REVOKE = `mutation R($orgId: ID!, $id: ID!) { revokeIntegrationClient(organizationId: $orgId, integrationId: $id) }`;
const ALL_SCOPES = Object.values(MachineScope);

/** Tudo o que a aplicação loga, como texto (com a pilha dos erros). */
class CapturingLogger implements LoggerService {
  readonly lines: string[] = [];

  private capture(level: string, args: unknown[]) {
    this.lines.push(
      `${level} ${args
        .map((arg) =>
          arg instanceof Error ? (arg.stack ?? arg.message) : String(arg),
        )
        .join(' ')}`,
    );
  }

  log(...args: unknown[]) {
    this.capture('log', args);
  }
  error(...args: unknown[]) {
    this.capture('error', args);
  }
  warn(...args: unknown[]) {
    this.capture('warn', args);
  }
  debug(...args: unknown[]) {
    this.capture('debug', args);
  }
  verbose(...args: unknown[]) {
    this.capture('verbose', args);
  }
  fatal(...args: unknown[]) {
    this.capture('fatal', args);
  }
}

let app: INestApplication;
let prisma: PrismaService;
let tokens: FakeTokenVerifier;
let machines: FakeMachineTokenVerifier;
let cognito: FakeMachineClientProvisioner;
let logs: CapturingLogger;
/** Corpo de cada resposta, menos as da criação bem-sucedida. */
let responses: string[];

let acmeId: string;
let betaId: string;
const users: Record<string, string> = {};

function graphql(
  query: string,
  variables: Record<string, unknown>,
  token = 'token-ana',
) {
  return request(app.getHttpServer())
    .post('/graphql')
    .set('Content-Type', 'application/json')
    .set('Authorization', `Bearer ${token}`)
    .send({ query, variables })
    .then((res) => {
      if (!res.body?.data?.createIntegrationClient) responses.push(res.text);
      return res;
    });
}

function create(
  input: { name?: string; scopes?: string[] } = {},
  token = 'token-ana',
  orgId = acmeId,
) {
  return graphql(
    CREATE,
    {
      orgId,
      name: input.name ?? 'ERP Financeiro',
      scopes: input.scopes ?? ALL_SCOPES,
    },
    token,
  );
}

async function createOk(input: { name?: string; scopes?: string[] } = {}) {
  const res = await create(input);
  expect(res.body.errors).toBeUndefined();
  return res.body.data.createIntegrationClient as {
    clientSecret: string;
    integration: Record<string, any> & { id: string; clientId: string };
  };
}

function revoke(id: string, token = 'token-ana') {
  return graphql(REVOKE, { orgId: acmeId, id }, token);
}

function expectError(
  res: request.Response,
  extensions: { code: string; reason: string },
) {
  expect(res.body.errors[0].extensions).toEqual(extensions);
}

function getMember(token: string, userId = users.bruno) {
  return request(app.getHttpServer())
    .get(`/v1/organizations/${acmeId}/members/${userId}`)
    .set('Authorization', `Bearer ${token}`);
}

async function createUser(sub: string) {
  tokens.register(`token-${sub}`, { sub });
  const user = await prisma.user.create({
    data: { cognitoSub: sub, name: sub, email: `${sub}@example.com` },
  });
  users[sub] = user.id;
}

async function rows() {
  return prisma.integrationClient.findMany({ orderBy: { createdAt: 'asc' } });
}

/** O texto de todas as linhas de todas as tabelas do banco de teste. */
async function dumpDatabase(): Promise<string> {
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
  let dump = '';
  for (const { table_name } of tables) {
    // Nome vindo do catálogo do próprio banco, não de entrada externa.
    const [{ text }] = await prisma.$queryRawUnsafe<{ text: string | null }[]>(
      `SELECT string_agg(row_to_json(t)::text, '') AS text FROM "${table_name}" t`,
    );
    dump += text ?? '';
  }
  return dump;
}

describe('Integrações self-service (e2e)', () => {
  beforeAll(async () => {
    tokens = new FakeTokenVerifier();
    machines = new FakeMachineTokenVerifier();
    cognito = new FakeMachineClientProvisioner();
    app = await createTestApp(
      tokens,
      new FakeIdentityProfileProvider(),
      machines,
      new SystemClock(),
      cognito,
    );
    prisma = app.get(PrismaService);
    // Depois de criar a aplicação: o compile() do TestingModule põe o
    // TestingLogger do Nest no lugar do logger estático.
    logs = new CapturingLogger();
    Logger.overrideLogger(logs);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    tokens.reset();
    machines.reset();
    cognito.reset();
    logs.lines.length = 0;
    responses = [];
    // Sem FK, o CASCADE das organizações não alcança security_events.
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "integration_clients", "memberships", "organizations", "users", "security_events" CASCADE`;

    for (const sub of ['ana', 'bruno', 'carla', 'davi']) await createUser(sub);
    acmeId = (
      await seedOrganization(prisma, {
        slug: 'acme',
        owner: users.ana,
        members: [{ userId: users.bruno }],
      })
    ).id;
    betaId = (
      await seedOrganization(prisma, { slug: 'beta', owner: users.davi })
    ).id;
  });

  afterEach(async () => {
    // Sigilo: o segredo não aparece em log, tabela nenhuma (audit_events,
    // security_events, integration_clients...) nem em resposta de erro.
    expect(logs.lines.join('\n')).not.toContain(FAKE_SECRET_MARKER);
    expect(await dumpDatabase()).not.toContain(FAKE_SECRET_MARKER);
    expect(responses.join('\n')).not.toContain(FAKE_SECRET_MARKER);
  });

  it('fluxo completo: cria, lista sem o segredo, autentica como máquina, revoga e deixa de autorizar', async () => {
    const created = await createOk({
      scopes: [MachineScope.AUTHORIZE, MachineScope.MEMBERS_READ],
    });
    const { integration, clientSecret } = created;

    expect(integration).toEqual({
      id: expect.any(String),
      name: 'ERP Financeiro',
      clientId: expect.any(String),
      scopes: [MachineScope.MEMBERS_READ, MachineScope.AUTHORIZE],
      status: 'ACTIVE',
      createdAt: expect.any(String),
      revokedAt: null,
      createdBy: { userId: users.ana, name: 'ana' },
    });
    expect(clientSecret).toBe(
      FakeMachineClientProvisioner.secretOf(integration.clientId),
    );
    expect(cognito.clients.get(integration.clientId)).toEqual({
      name: machineClientName(integration.id),
      scopes: [MachineScope.MEMBERS_READ, MachineScope.AUTHORIZE],
    });

    // A listagem não tem o segredo, nem como campo.
    const listed = await graphql(LIST, { orgId: acmeId });
    expect(listed.body.data.integrationClients).toEqual([integration]);
    const withSecret = await graphql(
      `
        query L($orgId: ID!) {
          integrationClients(organizationId: $orgId) {
            clientSecret
          }
        }
      `,
      { orgId: acmeId },
    );
    expect(withSecret.body.errors[0].extensions.code).toBe(
      'GRAPHQL_VALIDATION_FAILED',
    );

    // O client novo autentica como máquina sem lista fixa de client ids.
    machines.register('token-erp', {
      clientId: integration.clientId,
      scopes: [MachineScope.MEMBERS_READ],
    });
    expect((await getMember('token-erp')).status).toBe(200);

    expect((await revoke(integration.id)).body.data).toEqual({
      revokeIntegrationClient: true,
    });
    expect(cognito.deleted).toEqual([integration.clientId]);
    const [revoked] = (await graphql(LIST, { orgId: acmeId })).body.data
      .integrationClients;
    expect(revoked).toMatchObject({
      status: 'REVOKED',
      clientId: integration.clientId,
      revokedAt: expect.any(String),
    });
    const denied = await getMember('token-erp');
    expect(denied.status).toBe(404);
    expect(denied.body.error.reason).toBe('ORGANIZATION_NOT_FOUND');

    // Revogar de novo: true, sem evento novo e sem chamar o Cognito.
    expect((await revoke(integration.id)).body.data).toEqual({
      revokeIntegrationClient: true,
    });
    expect(cognito.deleted).toHaveLength(1);
    const events = await prisma.auditEvent.findMany({
      where: { organizationId: acmeId, targetType: 'integration' },
      orderBy: { occurredAt: 'asc' },
    });
    expect(events.map((e) => [e.action, e.targetId, e.details])).toEqual([
      [
        'integration.created',
        integration.id,
        {
          name: 'ERP Financeiro',
          scopes: [MachineScope.MEMBERS_READ, MachineScope.AUTHORIZE],
          clientId: integration.clientId,
        },
      ],
      [
        'integration.revoked',
        integration.id,
        { clientId: integration.clientId },
      ],
    ]);
  });

  describe('permissões', () => {
    it('MEMBER sem integrations:read nem integrations:manage: FORBIDDEN; não membro: NOT_FOUND', async () => {
      const denied = {
        code: 'FORBIDDEN',
        reason: 'ORGANIZATION_PERMISSION_DENIED',
      };
      expectError(
        await graphql(LIST, { orgId: acmeId }, 'token-bruno'),
        denied,
      );
      expectError(await create({}, 'token-bruno'), denied);
      expectError(await create({}, 'token-davi'), {
        code: 'NOT_FOUND',
        reason: 'ORGANIZATION_NOT_FOUND',
      });
      expect(await rows()).toEqual([]);
      expect(cognito.clients.size).toBe(0);
    });

    it('papel com integrations:read lista; com integrations:manage e members:read cria só members.read', async () => {
      const roleId = await seedRole(prisma, {
        organizationId: acmeId,
        name: 'Integrações',
        permissions: [
          'integrations:read',
          'integrations:manage',
          'members:read',
        ],
      });
      await seedMembership(prisma, {
        organizationId: acmeId,
        userId: users.carla,
        roleId,
      });

      expect(
        (await graphql(LIST, { orgId: acmeId }, 'token-carla')).body.data,
      ).toEqual({ integrationClients: [] });

      const escalation = await create(
        { scopes: [MachineScope.AUTHORIZE] },
        'token-carla',
      );
      expectError(escalation, {
        code: 'FORBIDDEN',
        reason: 'PRIVILEGE_ESCALATION',
      });
      expect(await rows()).toEqual([]);
      expect(cognito.clients.size).toBe(0);
      const [event] = await prisma.securityEvent.findMany({
        where: { organizationId: acmeId },
      });
      expect(event).toMatchObject({
        event: 'access.privilege_escalation',
        actorUserId: users.carla,
        details: { operation: 'createIntegrationClient' },
      });

      const ok = await create(
        { scopes: [MachineScope.MEMBERS_READ] },
        'token-carla',
      );
      expect(ok.body.data.createIntegrationClient.integration).toMatchObject({
        status: 'ACTIVE',
        scopes: [MachineScope.MEMBERS_READ],
        createdBy: { userId: users.carla, name: 'carla' },
      });
    });
  });

  it.each([
    ['nome curto', { name: 'x' }],
    ['sem escopo', { scopes: [] }],
    ['escopo fora do catálogo', { scopes: ['accessflow-api/admin'] }],
  ])('%s: BAD_REQUEST INVALID_INTEGRATION_CLIENT', async (_, input) => {
    expectError(await create(input), {
      code: 'BAD_REQUEST',
      reason: 'INVALID_INTEGRATION_CLIENT',
    });
    expect(await rows()).toEqual([]);
  });

  it('limite: a sexta em criação ou ativa é recusada; revogar libera a vaga', async () => {
    const { integration: first } = await createOk({ name: 'Integração 1' });
    for (let i = 2; i <= 5; i++) await createOk({ name: `Integração ${i}` });

    expectError(await create({ name: 'Sexta' }), {
      code: 'CONFLICT',
      reason: 'INTEGRATION_LIMIT_REACHED',
    });
    expect(cognito.clients.size).toBe(5);

    await revoke(first.id);
    await createOk({ name: 'Sexta' });
  });

  describe('falhas na criação', () => {
    it('Cognito fora do ar: BAD_GATEWAY, linha FAILED sem client, sem auditoria, motivo no log com o requestId', async () => {
      cognito.failCreate = new Error('ThrottlingException: Rate exceeded');

      const res = await create();

      expectError(res, {
        code: 'BAD_GATEWAY',
        reason: 'INTEGRATION_PROVISIONING_FAILED',
      });
      expect(res.text).not.toContain('Throttling');
      const [row] = await rows();
      expect(row).toMatchObject({ status: 'FAILED', clientId: null });
      expect(
        await prisma.auditEvent.count({ where: { targetType: 'integration' } }),
      ).toBe(0);
      const requestId = res.headers['x-request-id'];
      expect(logs.lines).toContainEqual(
        expect.stringContaining(
          `requestId=${requestId} Cognito não criou o app client da integração ${row.id}.`,
        ),
      );
      const [listed] = (await graphql(LIST, { orgId: acmeId })).body.data
        .integrationClients;
      expect(listed).toMatchObject({ status: 'FAILED', clientId: null });
    });

    it('banco recusa a ativação (passo 3): o client é apagado no Cognito e a linha fica FAILED', async () => {
      // client_id já gravado em outra organização: o unique derruba o passo 3.
      await prisma.integrationClient.create({
        data: {
          organizationId: betaId,
          clientId: 'client-repetido',
          name: 'Outra',
          scopes: ALL_SCOPES,
        },
      });
      cognito.nextClientId = 'client-repetido';

      const res = await create();

      expectError(res, {
        code: 'BAD_GATEWAY',
        reason: 'INTEGRATION_PROVISIONING_FAILED',
      });
      const failed = (await rows()).find((r) => r.organizationId === acmeId)!;
      expect(failed).toMatchObject({ status: 'FAILED', clientId: null });
      expect(cognito.deleted).toEqual(['client-repetido']);
      expect(
        await prisma.auditEvent.count({ where: { targetType: 'integration' } }),
      ).toBe(0);
      expect(logs.lines).toContainEqual(
        expect.stringContaining(
          `Integração ${failed.id} não foi ativada; apagando o app client client-repetido.`,
        ),
      );
    });

    it('passo 3 e a compensação falham: log com o client que ficou, e a linha FAILED', async () => {
      await prisma.integrationClient.create({
        data: {
          organizationId: betaId,
          clientId: 'client-repetido',
          name: 'Outra',
          scopes: ALL_SCOPES,
        },
      });
      cognito.nextClientId = 'client-repetido';
      cognito.afterCreate = async () => {
        cognito.failDelete = new Error('Cognito indisponível');
      };

      const res = await create();

      expectError(res, {
        code: 'BAD_GATEWAY',
        reason: 'INTEGRATION_PROVISIONING_FAILED',
      });
      const failed = (await rows()).find((r) => r.organizationId === acmeId)!;
      expect(failed.status).toBe('FAILED');
      expect(logs.lines).toContainEqual(
        expect.stringContaining(
          `requestId=${res.headers['x-request-id']} Compensação falhou: o app client client-repetido da integração ${failed.id} continua no Cognito; a reconciliação o apaga.`,
        ),
      );
    });
  });

  describe('revogação', () => {
    it('Cognito falha ao apagar: continua revogada (true) e o log diz o que ficou', async () => {
      const { integration } = await createOk();
      cognito.failDelete = new Error('Cognito indisponível');

      const res = await revoke(integration.id);

      expect(res.body.data).toEqual({ revokeIntegrationClient: true });
      expect((await rows())[0].status).toBe('REVOKED');
      expect(logs.lines).toContainEqual(
        expect.stringContaining(
          `requestId=${res.headers['x-request-id']} Integração ${integration.id} revogada, mas o app client ${integration.clientId} continua no Cognito; a reconciliação o apaga.`,
        ),
      );
    });

    it('inexistente, de outra organização ou malformada: NOT_FOUND; FAILED: CONFLICT', async () => {
      const other = await prisma.integrationClient.create({
        data: {
          organizationId: betaId,
          clientId: 'client-beta',
          name: 'Beta',
          scopes: ALL_SCOPES,
        },
      });
      for (const id of [crypto.randomUUID(), other.id, 'nao-e-uuid']) {
        expectError(await revoke(id), {
          code: 'NOT_FOUND',
          reason: 'INTEGRATION_NOT_FOUND',
        });
      }

      cognito.failCreate = new Error('fora do ar');
      await create();
      const [failed] = await rows().then((all) =>
        all.filter((r) => r.status === 'FAILED'),
      );
      expectError(await revoke(failed.id), {
        code: 'CONFLICT',
        reason: 'INTEGRATION_NOT_ACTIVE',
      });
    });

    it('MEMBER sem integrations:manage: FORBIDDEN, e nada muda', async () => {
      const { integration } = await createOk();

      expectError(await revoke(integration.id, 'token-bruno'), {
        code: 'FORBIDDEN',
        reason: 'ORGANIZATION_PERMISSION_DENIED',
      });
      expect((await rows())[0].status).toBe('ACTIVE');
      expect(cognito.deleted).toEqual([]);
    });
  });

  // Os testes de falha mostram que os logs são capturados; este mostra que a
  // varredura das tabelas acharia o segredo, se ele fosse gravado.
  it('sigilo: a varredura do banco acharia o segredo em qualquer tabela', async () => {
    const { clientSecret } = await createOk();
    expect(clientSecret).toContain(FAKE_SECRET_MARKER);
    expect(await dumpDatabase()).not.toContain(FAKE_SECRET_MARKER);

    await prisma.organization.update({
      where: { id: acmeId },
      data: { name: clientSecret },
    });
    expect(await dumpDatabase()).toContain(FAKE_SECRET_MARKER);

    await prisma.organization.update({
      where: { id: acmeId },
      data: { name: 'acme' },
    });
  });
});
