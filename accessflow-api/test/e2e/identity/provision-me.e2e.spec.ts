import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { FakeIdentityProfileProvider } from '@test/fakes/identity/fake-identity-profile-provider';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';

const PROVISION = `mutation Provision($name: String!) {
  provisionMe(input: { name: $name }) { id name email status }
}`;

let app: INestApplication;
let prisma: PrismaService;
let tokens: FakeTokenVerifier;
let profiles: FakeIdentityProfileProvider;

function graphql(
  query: string,
  variables: Record<string, unknown>,
  authorization?: string,
) {
  const req = request(app.getHttpServer())
    .post('/graphql')
    .set('Content-Type', 'application/json');
  if (authorization !== undefined) req.set('Authorization', authorization);
  return req.send({ query, variables });
}

describe('Mutation provisionMe (e2e)', () => {
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
    await prisma.$executeRaw`TRUNCATE TABLE "users" CASCADE`;

    tokens.register('token-ana', { sub: 'sub-ana' });
    profiles.register('token-ana', {
      sub: 'sub-ana',
      email: 'ana@example.com',
    });
  });

  it('cria o perfil e a query me passa a encontrá-lo', async () => {
    const res = await graphql(PROVISION, { name: 'Ana' }, 'Bearer token-ana');

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.provisionMe).toMatchObject({
      name: 'Ana',
      email: 'ana@example.com',
      status: 'ACTIVE',
    });

    const me = await graphql('{ me { id } }', {}, 'Bearer token-ana');
    expect(me.body.data.me.id).toBe(res.body.data.provisionMe.id);
  });

  it('é idempotente: chamadas repetidas devolvem o mesmo perfil', async () => {
    const first = await graphql(PROVISION, { name: 'Ana' }, 'Bearer token-ana');
    const second = await graphql(
      PROVISION,
      { name: 'Ana' },
      'Bearer token-ana',
    );

    expect(second.body.data.provisionMe.id).toBe(
      first.body.data.provisionMe.id,
    );
    expect(await prisma.user.count()).toBe(1);
  });

  it('chamadas simultâneas criam um único perfil', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        graphql(PROVISION, { name: 'Ana' }, 'Bearer token-ana'),
      ),
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const ids = new Set(results.map((res) => res.body.data.provisionMe.id));
    expect(ids.size).toBe(1);
    expect(await prisma.user.count()).toBe(1);
  });

  it('exige autenticação', async () => {
    const res = await graphql(PROVISION, { name: 'Ana' });

    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    expect(await prisma.user.count()).toBe(0);
  });

  it('recusa e-mail não verificado', async () => {
    profiles.register('token-ana', {
      sub: 'sub-ana',
      email: 'ana@example.com',
      emailVerified: false,
    });

    const res = await graphql(PROVISION, { name: 'Ana' }, 'Bearer token-ana');

    expect(res.body.errors[0].extensions).toEqual({
      code: 'FORBIDDEN',
      reason: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('recusa nome inválido', async () => {
    const res = await graphql(PROVISION, { name: ' ' }, 'Bearer token-ana');

    expect(res.body.errors[0].extensions).toEqual({
      code: 'BAD_REQUEST',
      reason: 'INVALID_USER',
    });
    expect(await prisma.user.count()).toBe(0);
  });

  it('não aceita e-mail vindo do cliente', async () => {
    const res = await graphql(
      'mutation { provisionMe(input: { name: "Ana", email: "falso@example.com" }) { id } }',
      {},
      'Bearer token-ana',
    );

    expect(res.body.errors[0].extensions.code).toBe(
      'GRAPHQL_VALIDATION_FAILED',
    );
  });
});
