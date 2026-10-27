import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';

const CREATE = `mutation Create($name: String!, $slug: String!) {
  createOrganization(input: { name: $name, slug: $slug }) { id }
}`;
const MEMBERS = `query Members($id: ID!, $first: Int, $after: String) {
  organizationMembers(organizationId: $id, first: $first, after: $after) {
    nodes { userId name email role joinedAt }
    pageInfo { hasNextPage endCursor }
  }
}`;
const REMOVE = `mutation Remove($id: ID!, $userId: ID!) {
  removeMember(organizationId: $id, userId: $userId)
}`;
const LEAVE = `mutation Leave($id: ID!) { leaveOrganization(organizationId: $id) }`;

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

async function createUser(sub: string) {
  tokens.register(`token-${sub}`, { sub });
  return prisma.user.create({
    data: { cognitoSub: sub, name: sub, email: `${sub}@example.com` },
  });
}

async function createOrganization(ownerSub: string): Promise<string> {
  const res = await graphql(
    CREATE,
    { name: 'Acme', slug: 'acme' },
    `token-${ownerSub}`,
  );
  return res.body.data.createOrganization.id;
}

async function addMember(organizationId: string, userId: string) {
  await prisma.membership.create({
    data: { organizationId, userId, role: 'MEMBER' },
  });
}

describe('Membros da organização (e2e)', () => {
  let organizationId: string;
  let ana: { id: string };
  let bruno: { id: string };

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

    ana = await createUser('ana');
    bruno = await createUser('bruno');
    organizationId = await createOrganization('ana');
    await addMember(organizationId, bruno.id);
  });

  describe('organizationMembers', () => {
    it('MEMBER lista os membros', async () => {
      const res = await graphql(MEMBERS, { id: organizationId }, 'token-bruno');

      expect(res.body.errors).toBeUndefined();
      const { nodes, pageInfo } = res.body.data.organizationMembers;
      expect(nodes).toMatchObject([
        {
          userId: ana.id,
          name: 'ana',
          email: 'ana@example.com',
          role: 'OWNER',
        },
        {
          userId: bruno.id,
          name: 'bruno',
          email: 'bruno@example.com',
          role: 'MEMBER',
        },
      ]);
      expect(pageInfo.hasNextPage).toBe(false);
      expect(typeof pageInfo.endCursor).toBe('string');
    });

    it('pagina usando o endCursor devolvido', async () => {
      for (const sub of ['carla', 'davi', 'eva']) {
        await addMember(organizationId, (await createUser(sub)).id);
      }

      const seen: string[] = [];
      let after: string | null = null;
      let pages = 0;
      do {
        const res = await graphql(
          MEMBERS,
          { id: organizationId, first: 2, after },
          'token-ana',
        );
        expect(res.body.errors).toBeUndefined();
        const { nodes, pageInfo } = res.body.data.organizationMembers;
        seen.push(...nodes.map((n: { userId: string }) => n.userId));
        after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
        pages++;
      } while (after);

      expect(pages).toBe(3);
      expect(seen).toHaveLength(5);
      expect(new Set(seen).size).toBe(5);
    });

    it('não membro recebe ORGANIZATION_NOT_FOUND', async () => {
      await createUser('carla');

      const res = await graphql(MEMBERS, { id: organizationId }, 'token-carla');

      expect(res.body.errors[0].extensions).toEqual({
        code: 'NOT_FOUND',
        reason: 'ORGANIZATION_NOT_FOUND',
      });
    });

    it('recusa cursor inválido com BAD_REQUEST', async () => {
      const res = await graphql(
        MEMBERS,
        { id: organizationId, after: 'cursor-inventado' },
        'token-bruno',
      );

      expect(res.body.errors[0].extensions).toEqual({
        code: 'BAD_REQUEST',
        reason: 'INVALID_CURSOR',
      });
    });
  });

  describe('removeMember', () => {
    it('OWNER remove MEMBER', async () => {
      const res = await graphql(
        REMOVE,
        { id: organizationId, userId: bruno.id },
        'token-ana',
      );

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.removeMember).toBe(true);
      const membership = await prisma.membership.findFirst({
        where: { organizationId, userId: bruno.id },
      });
      expect(membership?.status).toBe('REMOVED');
    });

    it('MEMBER não pode remover', async () => {
      const res = await graphql(
        REMOVE,
        { id: organizationId, userId: ana.id },
        'token-bruno',
      );

      expect(res.body.errors[0].extensions).toEqual({
        code: 'FORBIDDEN',
        reason: 'ORGANIZATION_PERMISSION_DENIED',
      });
    });
  });

  describe('leaveOrganization', () => {
    it('MEMBER sai e perde o acesso', async () => {
      const res = await graphql(LEAVE, { id: organizationId }, 'token-bruno');

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.leaveOrganization).toBe(true);

      const after = await graphql(
        MEMBERS,
        { id: organizationId },
        'token-bruno',
      );
      expect(after.body.errors[0].extensions).toEqual({
        code: 'NOT_FOUND',
        reason: 'ORGANIZATION_NOT_FOUND',
      });
    });

    it('o último OWNER não pode sair', async () => {
      const res = await graphql(LEAVE, { id: organizationId }, 'token-ana');

      expect(res.body.errors[0].extensions).toEqual({
        code: 'CONFLICT',
        reason: 'LAST_OWNER',
      });
    });
  });
});
