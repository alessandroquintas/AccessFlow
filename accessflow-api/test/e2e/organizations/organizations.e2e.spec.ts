import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';

const CREATE = `mutation Create($name: String!, $slug: String!) {
  createOrganization(input: { name: $name, slug: $slug }) { id name slug status viewerRole }
}`;
const MY_ORGANIZATIONS = '{ myOrganizations { id slug viewerRole } }';
const ORGANIZATION = `query Org($id: ID!) { organization(organizationId: $id) { id slug viewerRole } }`;

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
    data: { cognitoSub: sub, name: sub, email: `${sub}@example.com`, status },
  });
}

describe('Organizations (e2e)', () => {
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
    await prisma.$executeRaw`TRUNCATE TABLE "memberships", "organizations", "users" CASCADE`;
  });

  describe('createOrganization', () => {
    it('cria a organização com o criador como OWNER', async () => {
      const ana = await createUser('ana');

      const res = await graphql(
        CREATE,
        { name: 'Acme Corp', slug: 'ACME' },
        'token-ana',
      );

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.createOrganization).toMatchObject({
        name: 'Acme Corp',
        slug: 'acme',
        status: 'ACTIVE',
        viewerRole: 'OWNER',
      });

      const membership = await prisma.membership.findFirst({
        where: { userId: ana.id },
      });
      expect(membership?.role).toBe('OWNER');
    });

    it('recusa slug em uso com CONFLICT', async () => {
      await createUser('ana');
      await createUser('bruno');
      await graphql(CREATE, { name: 'Acme', slug: 'acme' }, 'token-ana');

      const res = await graphql(
        CREATE,
        { name: 'Outra', slug: 'acme' },
        'token-bruno',
      );

      expect(res.body.errors[0].extensions).toEqual({
        code: 'CONFLICT',
        reason: 'SLUG_ALREADY_TAKEN',
      });
    });

    it.each([
      ['reservado', 'admin'],
      ['formato inválido', 'acme corp'],
    ])('recusa slug %s com BAD_REQUEST', async (_cenario, slug) => {
      await createUser('ana');

      const res = await graphql(CREATE, { name: 'Acme', slug }, 'token-ana');

      expect(res.body.errors[0].extensions).toEqual({
        code: 'BAD_REQUEST',
        reason: 'INVALID_ORGANIZATION',
      });
      expect(await prisma.organization.count()).toBe(0);
    });

    it('exige perfil provisionado', async () => {
      tokens.register('token-sem-perfil', { sub: 'sem-perfil' });

      const res = await graphql(
        CREATE,
        { name: 'Acme', slug: 'acme' },
        'token-sem-perfil',
      );

      expect(res.body.errors[0].extensions).toEqual({
        code: 'NOT_FOUND',
        reason: 'USER_NOT_FOUND',
      });
    });

    it('bloqueia usuário inativo', async () => {
      await createUser('carla', 'INACTIVE');

      const res = await graphql(
        CREATE,
        { name: 'Acme', slug: 'acme' },
        'token-carla',
      );

      expect(res.body.errors[0].extensions).toEqual({
        code: 'FORBIDDEN',
        reason: 'USER_INACTIVE',
      });
    });

    it('exige autenticação', async () => {
      const res = await graphql(CREATE, { name: 'Acme', slug: 'acme' });

      expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('myOrganizations', () => {
    it('lista só as organizações do usuário autenticado', async () => {
      await createUser('ana');
      await createUser('bruno');
      await graphql(CREATE, { name: 'Acme', slug: 'acme' }, 'token-ana');
      await graphql(CREATE, { name: 'Beta', slug: 'beta' }, 'token-bruno');

      const res = await graphql(MY_ORGANIZATIONS, {}, 'token-ana');

      expect(res.body.data.myOrganizations).toEqual([
        expect.objectContaining({ slug: 'acme', viewerRole: 'OWNER' }),
      ]);
    });

    it('devolve lista vazia para quem não participa de nenhuma', async () => {
      await createUser('ana');

      const res = await graphql(MY_ORGANIZATIONS, {}, 'token-ana');

      expect(res.body.data.myOrganizations).toEqual([]);
    });
  });

  describe('organization', () => {
    it('devolve a organização para um membro', async () => {
      await createUser('ana');
      const created = await graphql(
        CREATE,
        { name: 'Acme', slug: 'acme' },
        'token-ana',
      );
      const id = created.body.data.createOrganization.id;

      const res = await graphql(ORGANIZATION, { id }, 'token-ana');

      expect(res.body.data.organization).toEqual({
        id,
        slug: 'acme',
        viewerRole: 'OWNER',
      });
    });

    it('não revela a organização a quem não é membro', async () => {
      await createUser('ana');
      await createUser('bruno');
      const created = await graphql(
        CREATE,
        { name: 'Acme', slug: 'acme' },
        'token-ana',
      );
      const id = created.body.data.createOrganization.id;

      const res = await graphql(ORGANIZATION, { id }, 'token-bruno');

      expect(res.body.data).toBeNull();
      expect(res.body.errors[0].extensions).toEqual({
        code: 'NOT_FOUND',
        reason: 'ORGANIZATION_NOT_FOUND',
      });
    });

    it('responde igual para organização inexistente e id malformado', async () => {
      await createUser('ana');

      const inexistente = await graphql(
        ORGANIZATION,
        { id: crypto.randomUUID() },
        'token-ana',
      );
      const malformado = await graphql(
        ORGANIZATION,
        { id: 'nao-e-uuid' },
        'token-ana',
      );

      expect(inexistente.body.errors[0].extensions.reason).toBe(
        'ORGANIZATION_NOT_FOUND',
      );
      expect(malformado.body.errors[0].extensions.reason).toBe(
        'ORGANIZATION_NOT_FOUND',
      );
    });
  });
});
