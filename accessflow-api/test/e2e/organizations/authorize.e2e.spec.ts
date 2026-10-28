import {
  afterAll,
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
import { MachineScope } from '@/modules/identity/presentation/auth/machine-scope';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { FakeMachineTokenVerifier } from '@test/fakes/identity/fake-machine-token-verifier';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';
import {
  seedMembership,
  seedOrganization,
  seedRole,
} from '@test/factory/organizations/seed-organization';

const APPROVE = 'invoices:approve';
const SIGN = 'contracts:sign';

let app: INestApplication;
let prisma: PrismaService;
let tokens: FakeTokenVerifier;
let machines: FakeMachineTokenVerifier;

let acmeId: string;
let betaId: string;
const users: Record<string, string> = {};

function post(body: unknown, token?: string) {
  const req = request(app.getHttpServer()).post('/v1/authorize');
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send(body as object);
}

function authorize(
  userId: string,
  permissions: unknown,
  organizationId: string = acmeId,
  token = 'token-acme',
) {
  return post({ organizationId, userId, permissions }, token);
}

async function createUser(sub: string, status: 'ACTIVE' | 'INACTIVE') {
  tokens.register(`token-${sub}`, { sub });
  const user = await prisma.user.create({
    data: { cognitoSub: sub, name: sub, email: `${sub}@example.com`, status },
  });
  users[sub] = user.id;
  return user;
}

/** Tudo false, no mesmo formato da resposta de membro sem permissão. */
function allDenied(userId: string, permissions: string[]) {
  return {
    organizationId: acmeId,
    userId,
    allowed: false,
    results: permissions.map((permission) => ({ permission, allowed: false })),
  };
}

describe('POST /v1/authorize (e2e)', () => {
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
    await prisma.$executeRaw`TRUNCATE TABLE "authorization_decisions", "invitations", "integration_clients", "memberships", "organizations", "users" CASCADE`;

    const ana = await createUser('ana', 'ACTIVE');
    const bruno = await createUser('bruno', 'ACTIVE');
    const carla = await createUser('carla', 'INACTIVE');
    const davi = await createUser('davi', 'ACTIVE');
    await createUser('eva', 'ACTIVE');

    const acme = await seedOrganization(prisma, {
      slug: 'acme',
      owner: ana.id,
    });
    const beta = await seedOrganization(prisma, {
      slug: 'beta',
      owner: ana.id,
    });
    acmeId = acme.id;
    betaId = beta.id;
    await prisma.customPermission.createMany({
      data: [
        { organizationId: acmeId, key: APPROVE, description: 'Aprovar' },
        { organizationId: acmeId, key: SIGN, description: 'Assinar' },
        { organizationId: betaId, key: 'payments:refund', description: 'X' },
      ],
    });
    const financeId = await seedRole(prisma, {
      organizationId: acmeId,
      name: 'Financeiro',
      permissions: ['members:read', APPROVE],
    });
    await seedMembership(prisma, {
      organizationId: acmeId,
      userId: bruno.id,
      roleId: financeId,
    });
    // Conta desativada no identity, com membership ACTIVE e papel OWNER.
    await seedMembership(prisma, {
      organizationId: acmeId,
      userId: carla.id,
      role: 'OWNER',
    });
    await seedMembership(prisma, {
      organizationId: acmeId,
      userId: davi.id,
      roleId: financeId,
      status: 'REMOVED',
    });

    await prisma.integrationClient.create({
      data: { clientId: 'client-acme', organizationId: acmeId, name: 'ERP' },
    });
    machines.register('token-acme', {
      clientId: 'client-acme',
      scopes: [MachineScope.AUTHORIZE],
    });
    machines.register('token-acme-members', {
      clientId: 'client-acme',
      scopes: [MachineScope.MEMBERS_READ],
    });
  });

  describe('200', () => {
    it('tudo permitido, com o corpo exato', async () => {
      const res = await authorize(users.bruno, [APPROVE, 'members:read']);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        organizationId: acmeId,
        userId: users.bruno,
        allowed: true,
        results: [
          { permission: APPROVE, allowed: true },
          { permission: 'members:read', allowed: true },
        ],
      });
    });

    it('parcial: allowed false; repetidas saem e a ordem do pedido fica', async () => {
      const res = await authorize(users.bruno, [
        SIGN,
        APPROVE,
        SIGN,
        'members:invite',
      ]);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        organizationId: acmeId,
        userId: users.bruno,
        allowed: false,
        results: [
          { permission: SIGN, allowed: false },
          { permission: APPROVE, allowed: true },
          { permission: 'members:invite', allowed: false },
        ],
      });
    });

    it('OWNER: personalizada da organização true; chave inexistente em formato válido false', async () => {
      const res = await authorize(users.ana, [
        APPROVE,
        'permissions:manage',
        'invoices:refund',
        'payments:refund',
      ]);

      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([
        { permission: APPROVE, allowed: true },
        { permission: 'permissions:manage', allowed: true },
        { permission: 'invoices:refund', allowed: false },
        { permission: 'payments:refund', allowed: false },
      ]);
      expect(res.body.allowed).toBe(false);
    });

    it('chave desconhecida em formato válido não é erro: vem false', async () => {
      const res = await authorize(users.bruno, ['reports:export']);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        organizationId: acmeId,
        userId: users.bruno,
        allowed: false,
        results: [{ permission: 'reports:export', allowed: false }],
      });
    });

    it.each([
      ['não membro', 'eva'],
      ['membro removido', 'davi'],
      ['conta desativada, com membership ACTIVE de OWNER', 'carla'],
    ])('%s: tudo false, no mesmo formato', async (_, sub) => {
      const permissions = [APPROVE, 'members:read'];

      const res = await authorize(users[sub], permissions);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(allDenied(users[sub], permissions));
    });

    it('usuário inexistente: tudo false', async () => {
      const userId = crypto.randomUUID();

      const res = await authorize(userId, [APPROVE]);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(allDenied(userId, [APPROVE]));
    });
  });

  describe('400', () => {
    it.each([
      [
        'chave mal formatada',
        () => [APPROVE, 'Invoices:Approve'],
        'INVALID_PERMISSION_KEY',
      ],
      [
        '26 itens',
        () => Array.from({ length: 26 }, (_, i) => `r${i}:read`),
        'INVALID_AUTHORIZATION_REQUEST',
      ],
      ['lista vazia', () => [], 'INVALID_AUTHORIZATION_REQUEST'],
      [
        'permissions que não é lista',
        () => APPROVE,
        'INVALID_AUTHORIZATION_REQUEST',
      ],
      [
        'lista com algo que não é texto',
        () => [APPROVE, 42],
        'INVALID_AUTHORIZATION_REQUEST',
      ],
    ])('%s', async (_, permissions, reason) => {
      const res = await authorize(users.bruno, permissions());

      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: 'BAD_REQUEST', reason });
    });

    it('corpo que não é JSON válido: INVALID_JSON, sem o texto do parser', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/authorize')
        .set('Authorization', 'Bearer token-acme')
        .set('Content-Type', 'application/json')
        .send('{oops');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: {
          code: 'BAD_REQUEST',
          reason: 'INVALID_JSON',
          message: 'O corpo da requisição não é um JSON válido.',
        },
      });
    });

    it('organizationId ou userId que não é UUID', async () => {
      for (const res of [
        await authorize(users.bruno, [APPROVE], 'nao-e-uuid'),
        await authorize('nao-e-uuid', [APPROVE]),
        await post(
          { userId: users.bruno, permissions: [APPROVE] },
          'token-acme',
        ),
      ]) {
        expect(res.status).toBe(400);
        expect(res.body.error).toMatchObject({
          code: 'BAD_REQUEST',
          reason: 'INVALID_AUTHORIZATION_REQUEST',
        });
      }
    });
  });

  describe('autenticação e escopo', () => {
    it('401 sem token, com WWW-Authenticate', async () => {
      const res = await authorize(users.bruno, [APPROVE], acmeId, '');

      expect(res.status).toBe(401);
      expect(res.headers['www-authenticate']).toBe('Bearer');
      expect(res.body.error).toMatchObject({
        code: 'UNAUTHENTICATED',
        reason: 'INVALID_ACCESS_TOKEN',
      });
    });

    it('401 com token de usuário em vez de máquina', async () => {
      const res = await authorize(users.bruno, [APPROVE], acmeId, 'token-ana');

      expect(res.status).toBe(401);
      expect(res.body.error.reason).toBe('INVALID_ACCESS_TOKEN');
    });

    it('403 com token de máquina sem o escopo authorize', async () => {
      const res = await authorize(
        users.bruno,
        [APPROVE],
        acmeId,
        'token-acme-members',
      );

      expect(res.status).toBe(403);
      expect(res.body.error).toMatchObject({
        code: 'FORBIDDEN',
        reason: 'INSUFFICIENT_SCOPE',
      });
    });
  });

  it('404 para organização não vinculada ao client, com o corpo do GET de membros', async () => {
    const res = await authorize(users.ana, [APPROVE], betaId);
    const members = await request(app.getHttpServer())
      .get(`/v1/organizations/${betaId}/members/${users.ana}`)
      .set('Authorization', 'Bearer token-acme-members');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        reason: 'ORGANIZATION_NOT_FOUND',
        message: 'Organização não encontrada.',
      },
    });
    expect(res.body).toEqual(members.body);
  });
  describe('registro da decisão', () => {
    it.each([
      ['tudo permitido', 'bruno', ['members:read', APPROVE]],
      ['parcial, com repetidas', 'bruno', [SIGN, APPROVE, SIGN]],
      ['não membro', 'eva', [APPROVE]],
      ['membro removido', 'davi', [APPROVE]],
      ['conta desativada', 'carla', [APPROVE, 'members:read']],
    ])(
      '200 %s: exatamente uma decisão, igual à resposta',
      async (_, sub, permissions) => {
        const res = await authorize(users[sub], permissions);

        expect(res.status).toBe(200);
        expect(await prisma.authorizationDecision.findMany()).toEqual([
          {
            id: expect.any(String),
            organizationId: acmeId,
            clientId: 'client-acme',
            subjectUserId: users[sub],
            results: res.body.results,
            allowed: res.body.allowed,
            requestId: res.headers['x-request-id'],
            decidedAt: expect.any(Date),
          },
        ]);
      },
    );

    it.each([
      ['400 chave fora do formato', () => authorize(users.bruno, ['X:y'])],
      ['400 userId que não é UUID', () => authorize('nao-e-uuid', [APPROVE])],
      [
        '400 corpo que não é JSON',
        () =>
          request(app.getHttpServer())
            .post('/v1/authorize')
            .set('Authorization', 'Bearer token-acme')
            .set('Content-Type', 'application/json')
            .send('{oops'),
      ],
      ['401 sem token', () => authorize(users.bruno, [APPROVE], acmeId, '')],
      [
        '403 sem o escopo',
        () => authorize(users.bruno, [APPROVE], acmeId, 'token-acme-members'),
      ],
      ['404 outra organização', () => authorize(users.ana, [APPROVE], betaId)],
    ])('%s: nenhuma decisão', async (label, send) => {
      const res = await send();

      expect(res.status).toBe(Number(label.slice(0, 3)));
      expect(await prisma.authorizationDecision.count()).toBe(0);
    });

    it('falha ao gravar: 500 mascarado, sem a decisão no corpo e sem registro', async () => {
      const logError = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      // Falha de verdade no banco, só durante este teste.
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION test_fail_decision() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'gravação recusada no teste'; END $$`);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER test_fail_decision BEFORE INSERT ON authorization_decisions
        FOR EACH ROW EXECUTE FUNCTION test_fail_decision()`);
      try {
        const res = await authorize(users.bruno, ['members:read', APPROVE]);

        expect(res.status).toBe(500);
        expect(res.body).toEqual({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erro interno do servidor.',
            requestId: res.headers['x-request-id'],
          },
        });
        expect(await prisma.authorizationDecision.count()).toBe(0);
        expect(logError).toHaveBeenCalledWith(
          `requestId=${res.headers['x-request-id']}`,
          expect.any(Error),
        );
      } finally {
        await prisma.$executeRawUnsafe(
          'DROP TRIGGER test_fail_decision ON authorization_decisions',
        );
        await prisma.$executeRawUnsafe('DROP FUNCTION test_fail_decision()');
        logError.mockRestore();
      }

      // Sem a falha, o mesmo pedido volta a responder e a registrar.
      expect((await authorize(users.bruno, [APPROVE])).status).toBe(200);
      expect(await prisma.authorizationDecision.count()).toBe(1);
    });

    it('ação administrativa em andamento na organização: o authorize responde sem esperar por ela', async () => {
      // T0 trava a organização como toda ação administrativa (FOR UPDATE) e
      // só termina depois da resposta. Com FK, o INSERT da decisão esperaria
      // essa trava, e o pedido só voltaria no timeout de T0.
      await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${acmeId}::uuid FOR UPDATE`;

          const started = Date.now();
          const res = await authorize(users.bruno, [APPROVE]);

          expect(Date.now() - started).toBeLessThan(1000);
          expect(res.status).toBe(200);
        },
        { timeout: 3_000 },
      );
      expect(await prisma.authorizationDecision.count()).toBe(1);
    });
  });
});
