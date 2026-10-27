import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';

const UPDATE = `mutation Update($name: String!) {
  updateMyProfile(input: { name: $name }) { id name email }
}`;
const ME = '{ me { id name email } }';

let app: INestApplication;
let prisma: PrismaService;
let tokens: FakeTokenVerifier;

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

async function createUser(
  sub: string,
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
) {
  tokens.register(`token-${sub}`, { sub });
  return prisma.user.create({
    data: { cognitoSub: sub, name: 'Ana', email: `${sub}@example.com`, status },
  });
}

describe('Mutation updateMyProfile (e2e)', () => {
  beforeAll(async () => {
    tokens = new FakeTokenVerifier();
    app = await createTestApp(tokens);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    tokens.reset();
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "memberships", "organizations", "users" CASCADE`;
  });

  it('atualiza o nome e a query me reflete a mudança', async () => {
    const ana = await createUser('ana');

    const res = await graphql(UPDATE, { name: 'Ana Paula' }, 'token-ana');

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.updateMyProfile).toEqual({
      id: ana.id,
      name: 'Ana Paula',
      email: 'ana@example.com',
    });

    const me = await graphql(ME, {}, 'token-ana');
    expect(me.body.data.me.name).toBe('Ana Paula');
  });

  it('recusa nome inválido com BAD_REQUEST e não grava', async () => {
    await createUser('ana');

    const res = await graphql(UPDATE, { name: 'A' }, 'token-ana');

    expect(res.body.errors[0].extensions).toEqual({
      code: 'BAD_REQUEST',
      reason: 'INVALID_USER',
    });
    const stored = await prisma.user.findUnique({
      where: { cognitoSub: 'ana' },
    });
    expect(stored?.name).toBe('Ana');
  });

  it('exige autenticação', async () => {
    const res = await graphql(UPDATE, { name: 'Ana Paula' });

    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it('responde NOT_FOUND quando o perfil não foi provisionado', async () => {
    tokens.register('token-sem-perfil', { sub: 'sem-perfil' });

    const res = await graphql(
      UPDATE,
      { name: 'Ana Paula' },
      'token-sem-perfil',
    );

    expect(res.body.errors[0].extensions).toEqual({
      code: 'NOT_FOUND',
      reason: 'USER_NOT_FOUND',
    });
  });

  it('bloqueia perfil inativo', async () => {
    await createUser('carla', 'INACTIVE');

    const res = await graphql(UPDATE, { name: 'Carla Souza' }, 'token-carla');

    expect(res.body.errors[0].extensions).toEqual({
      code: 'FORBIDDEN',
      reason: 'USER_INACTIVE',
    });
  });

  it('não aceita e-mail no input', async () => {
    await createUser('ana');

    // Literal no documento: via variável, o Apollo responderia BAD_USER_INPUT.
    const res = await graphql(
      'mutation { updateMyProfile(input: { name: "Ana Paula", email: "outro@example.com" }) { id } }',
      {},
      'token-ana',
    );

    expect(res.body.errors[0].extensions.code).toBe(
      'GRAPHQL_VALIDATION_FAILED',
    );
    const stored = await prisma.user.findUnique({
      where: { cognitoSub: 'ana' },
    });
    expect(stored?.email).toBe('ana@example.com');
    expect(stored?.name).toBe('Ana');
  });
});
