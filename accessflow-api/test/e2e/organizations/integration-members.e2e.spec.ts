import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { MachineScope } from '@/modules/identity/presentation/auth/machine-scope';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { FakeMachineTokenVerifier } from '@test/fakes/identity/fake-machine-token-verifier';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';

let app: INestApplication;
let prisma: PrismaService;
let tokens: FakeTokenVerifier;
let machines: FakeMachineTokenVerifier;

let acmeId: string;
let betaId: string;
const users: Record<string, string> = {};

function getMember(organizationId: string, userId: string, token?: string) {
  const req = request(app.getHttpServer()).get(
    `/v1/organizations/${organizationId}/members/${userId}`,
  );
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req;
}

async function createUser(sub: string, status: 'ACTIVE' | 'INACTIVE') {
  tokens.register(`token-${sub}`, { sub });
  const user = await prisma.user.create({
    data: { cognitoSub: sub, name: sub, email: `${sub}@example.com`, status },
  });
  users[sub] = user.id;
  return user;
}

async function createOrganization(slug: string, ownerId: string) {
  const organization = await prisma.organization.create({
    data: { name: slug, slug },
  });
  await prisma.membership.create({
    data: { organizationId: organization.id, userId: ownerId, role: 'OWNER' },
  });
  return organization.id;
}

describe('GET /v1/organizations/:organizationId/members/:userId (e2e)', () => {
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

    const ana = await createUser('ana', 'ACTIVE');
    const bruno = await createUser('bruno', 'ACTIVE');
    const carla = await createUser('carla', 'INACTIVE');
    const davi = await createUser('davi', 'ACTIVE');
    await createUser('eva', 'ACTIVE');

    acmeId = await createOrganization('acme', ana.id);
    betaId = await createOrganization('beta', ana.id);
    await prisma.membership.createMany({
      data: [
        { organizationId: acmeId, userId: bruno.id, role: 'MEMBER' },
        { organizationId: acmeId, userId: carla.id, role: 'MEMBER' },
        {
          organizationId: acmeId,
          userId: davi.id,
          role: 'MEMBER',
          status: 'REMOVED',
        },
      ],
    });

    await prisma.integrationClient.create({
      data: { clientId: 'client-acme', organizationId: acmeId, name: 'ERP' },
    });
    machines.register('token-acme', {
      clientId: 'client-acme',
      scopes: [MachineScope.MEMBERS_READ],
    });
    machines.register('token-acme-sem-escopo', {
      clientId: 'client-acme',
      scopes: [],
    });
  });

  it('200 para membro ativo, com o corpo exato', async () => {
    const membership = await prisma.membership.findFirstOrThrow({
      where: { organizationId: acmeId, userId: users.bruno },
    });

    const res = await getMember(acmeId, users.bruno, 'token-acme');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      organizationId: acmeId,
      userId: users.bruno,
      role: 'MEMBER',
      joinedAt: membership.createdAt.toISOString(),
    });
  });

  describe('autenticação e escopo', () => {
    it('401 sem token, com WWW-Authenticate e corpo de erro exato', async () => {
      const res = await getMember(acmeId, users.bruno);

      expect(res.status).toBe(401);
      expect(res.headers['www-authenticate']).toBe('Bearer');
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHENTICATED',
          reason: 'INVALID_ACCESS_TOKEN',
          message: 'Token de acesso inválido ou expirado.',
        },
      });
    });

    it('401 com token de USUÁRIO', async () => {
      const res = await getMember(acmeId, users.bruno, 'token-ana');

      expect(res.status).toBe(401);
      expect(res.body.error.reason).toBe('INVALID_ACCESS_TOKEN');
    });

    it('403 sem o escopo exigido', async () => {
      const res = await getMember(acmeId, users.bruno, 'token-acme-sem-escopo');

      expect(res.status).toBe(403);
      expect(res.headers['www-authenticate']).toBeUndefined();
      expect(res.body).toEqual({
        error: {
          code: 'FORBIDDEN',
          reason: 'INSUFFICIENT_SCOPE',
          message: 'O token não tem permissão para esta operação.',
        },
      });
    });
  });

  describe('404', () => {
    it('organização de outro tenant', async () => {
      const res = await getMember(betaId, users.ana, 'token-acme');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: {
          code: 'NOT_FOUND',
          reason: 'ORGANIZATION_NOT_FOUND',
          message: 'Organização não encontrada.',
        },
      });
    });

    it('client revogado', async () => {
      await prisma.integrationClient.update({
        where: { clientId: 'client-acme' },
        data: { status: 'REVOKED' },
      });

      const res = await getMember(acmeId, users.bruno, 'token-acme');

      expect(res.status).toBe(404);
      expect(res.body.error.reason).toBe('ORGANIZATION_NOT_FOUND');
    });

    it.each([
      ['não membro', 'eva'],
      ['membro removido', 'davi'],
      ['usuário inativo', 'carla'],
    ])('%s', async (_cenario, sub) => {
      const res = await getMember(acmeId, users[sub], 'token-acme');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: {
          code: 'NOT_FOUND',
          reason: 'MEMBER_NOT_FOUND',
          message: 'Membro não encontrado nesta organização.',
        },
      });
    });

    it('organizationId malformado', async () => {
      const res = await getMember('nao-e-uuid', users.bruno, 'token-acme');

      expect(res.status).toBe(404);
      expect(res.body.error.reason).toBe('ORGANIZATION_NOT_FOUND');
    });

    it('userId malformado', async () => {
      const res = await getMember(acmeId, 'nao-e-uuid', 'token-acme');

      expect(res.status).toBe(404);
      expect(res.body.error.reason).toBe('MEMBER_NOT_FOUND');
    });
  });

  describe('separação entre tokens de máquina e de usuário', () => {
    it('token de MÁQUINA na query me do GraphQL → UNAUTHENTICATED', async () => {
      const res = await request(app.getHttpServer())
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer token-acme')
        .send({ query: '{ me { id } }' });

      expect(res.body.errors[0].extensions).toEqual({
        code: 'UNAUTHENTICATED',
        reason: 'INVALID_ACCESS_TOKEN',
      });
    });
  });
});
