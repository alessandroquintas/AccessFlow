import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { MachineScope } from '@/modules/identity/presentation/auth/machine-scope';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { FakeIdentityProfileProvider } from '@test/fakes/identity/fake-identity-profile-provider';
import { FakeMachineTokenVerifier } from '@test/fakes/identity/fake-machine-token-verifier';
import { FixedClock } from '@test/fakes/shared/fixed-clock';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';
import {
  seedMembership,
  seedOrganization,
} from '@test/factory/organizations/seed-organization';

const START = new Date('2026-03-01T12:00:00.000Z');
const at = (seconds: number) =>
  new Date(START.getTime() + seconds * 1000).toISOString();

const DECISIONS = `query Decisions($orgId: ID!, $first: Int, $after: String, $filter: AuthorizationDecisionFilter) {
  authorizationDecisions(organizationId: $orgId, first: $first, after: $after, filter: $filter) {
    nodes {
      id clientId subjectUserId allowed decidedAt requestId
      results { permission allowed }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

interface DecisionNode {
  id: string;
  clientId: string;
  subjectUserId: string;
  allowed: boolean;
  decidedAt: string;
  requestId: string | null;
  results: { permission: string; allowed: boolean }[];
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
  token: string,
) {
  return request(app.getHttpServer())
    .post('/graphql')
    .set({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    })
    .send({ query, variables });
}

async function decisions(
  variables: { first?: number; after?: string; filter?: object } = {},
  token = 'token-ana',
  organizationId = acmeId,
) {
  const res = await graphql(
    DECISIONS,
    { orgId: organizationId, first: 50, ...variables },
    token,
  );
  expect(res.body.errors).toBeUndefined();
  return res.body.data.authorizationDecisions as {
    nodes: DecisionNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

/** Um POST /v1/authorize de verdade, um segundo depois do anterior. */
async function authorize(
  token: string,
  organizationId: string,
  userId: string,
  permissions: string[],
) {
  clock.advance(1000);
  const res = await request(app.getHttpServer())
    .post('/v1/authorize')
    .set('Authorization', `Bearer ${token}`)
    .send({ organizationId, userId, permissions });
  expect(res.status).toBe(200);
  return res.headers['x-request-id'];
}

async function createUser(sub: string) {
  tokens.register(`token-${sub}`, { sub });
  const user = await prisma.user.create({
    data: { cognitoSub: sub, name: sub, email: `${sub}@example.com` },
  });
  users[sub] = user.id;
}

describe('authorizationDecisions (e2e)', () => {
  const requestIds: string[] = [];

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
    requestIds.length = 0;
    await prisma.$executeRaw`TRUNCATE TABLE "authorization_decisions", "invitations", "integration_clients", "memberships", "organizations", "users" CASCADE`;

    for (const sub of ['ana', 'bruno', 'eva', 'fabio']) await createUser(sub);
    acmeId = (
      await seedOrganization(prisma, { slug: 'acme', owner: users.ana })
    ).id;
    betaId = (
      await seedOrganization(prisma, { slug: 'beta', owner: users.fabio })
    ).id;
    await seedMembership(prisma, {
      organizationId: acmeId,
      userId: users.bruno,
    });

    for (const [clientId, organizationId] of [
      ['client-acme', acmeId],
      ['client-erp', acmeId],
      ['client-beta', betaId],
    ]) {
      await prisma.integrationClient.create({
        data: { clientId, organizationId, name: clientId },
      });
      machines.register(`token-${clientId}`, {
        clientId,
        scopes: [MachineScope.AUTHORIZE],
      });
    }

    // Quatro decisões na Acme (uma por segundo) e uma na Beta.
    requestIds.push(
      await authorize('token-client-acme', acmeId, users.ana, ['members:read']),
      await authorize('token-client-erp', acmeId, users.bruno, [
        'roles:manage',
      ]),
      await authorize('token-client-acme', acmeId, users.eva, [
        'members:read',
        'roles:manage',
      ]),
      await authorize('token-client-acme', acmeId, users.ana, [
        'roles:manage',
        'members:read',
      ]),
    );
    await authorize('token-client-beta', betaId, users.fabio, ['members:read']);
  });

  const times = (nodes: DecisionNode[]) => nodes.map((n) => n.decidedAt);

  it('da mais recente para a mais antiga, com os resultados tipados e o requestId de cada authorize', async () => {
    const { nodes, pageInfo } = await decisions();

    expect(pageInfo).toEqual({
      hasNextPage: false,
      endCursor: expect.any(String),
    });
    expect(nodes).toEqual([
      {
        id: expect.any(String),
        clientId: 'client-acme',
        subjectUserId: users.ana,
        allowed: true,
        decidedAt: at(4),
        requestId: requestIds[3],
        results: [
          { permission: 'roles:manage', allowed: true },
          { permission: 'members:read', allowed: true },
        ],
      },
      {
        id: expect.any(String),
        clientId: 'client-acme',
        subjectUserId: users.eva,
        allowed: false,
        decidedAt: at(3),
        requestId: requestIds[2],
        results: [
          { permission: 'members:read', allowed: false },
          { permission: 'roles:manage', allowed: false },
        ],
      },
      {
        id: expect.any(String),
        clientId: 'client-erp',
        subjectUserId: users.bruno,
        allowed: false,
        decidedAt: at(2),
        requestId: requestIds[1],
        results: [{ permission: 'roles:manage', allowed: false }],
      },
      {
        id: expect.any(String),
        clientId: 'client-acme',
        subjectUserId: users.ana,
        allowed: true,
        decidedAt: at(1),
        requestId: requestIds[0],
        results: [{ permission: 'members:read', allowed: true }],
      },
    ]);
  });

  it('pagina pelo cursor sem repetir nem pular', async () => {
    const first = await decisions({ first: 3 });
    const second = await decisions({
      first: 3,
      after: first.pageInfo.endCursor!,
    });

    expect(times(first.nodes)).toEqual([at(4), at(3), at(2)]);
    expect(first.pageInfo.hasNextPage).toBe(true);
    expect(times(second.nodes)).toEqual([at(1)]);
    expect(second.pageInfo.hasNextPage).toBe(false);
  });

  it('filtros, sozinhos e combinados', async () => {
    const by = async (filter: object) =>
      times((await decisions({ filter })).nodes);

    expect(await by({ subjectUserId: users.bruno.toUpperCase() })).toEqual([
      at(2),
    ]);
    expect(await by({ clientId: 'client-erp' })).toEqual([at(2)]);
    expect(await by({ allowed: false })).toEqual([at(3), at(2)]);
    expect(await by({ permission: 'roles:manage' })).toEqual([
      at(4),
      at(3),
      at(2),
    ]);
    expect(await by({ decidedFrom: at(2), decidedTo: at(3) })).toEqual([
      at(3),
      at(2),
    ]);
    expect(
      await by({
        permission: 'members:read',
        allowed: true,
        clientId: 'client-acme',
      }),
    ).toEqual([at(4), at(1)]);
  });

  it('filtro inválido: BAD_REQUEST INVALID_AUDIT_FILTER', async () => {
    for (const filter of [
      { subjectUserId: 'ana' },
      { permission: 'Members:Read' },
      { decidedFrom: at(3), decidedTo: at(2) },
    ]) {
      const res = await graphql(
        DECISIONS,
        { orgId: acmeId, filter },
        'token-ana',
      );

      expect(res.body.errors[0].extensions).toEqual({
        code: 'BAD_REQUEST',
        reason: 'INVALID_AUDIT_FILTER',
      });
    }
  });

  it('membro sem audit:read: FORBIDDEN; não membro: NOT_FOUND', async () => {
    const member = await graphql(DECISIONS, { orgId: acmeId }, 'token-bruno');
    const outsider = await graphql(DECISIONS, { orgId: acmeId }, 'token-eva');

    expect(member.body.errors[0].extensions).toEqual({
      code: 'FORBIDDEN',
      reason: 'ORGANIZATION_PERMISSION_DENIED',
    });
    expect(outsider.body.errors[0].extensions).toEqual({
      code: 'NOT_FOUND',
      reason: 'ORGANIZATION_NOT_FOUND',
    });
  });

  it('outra organização é invisível: a da Beta não aparece na Acme, e a Beta é NOT_FOUND para quem é só da Acme', async () => {
    const acme = await decisions();
    const beta = await decisions({}, 'token-fabio', betaId);
    const crossed = await graphql(DECISIONS, { orgId: betaId }, 'token-ana');

    expect(acme.nodes.map((n) => n.clientId)).not.toContain('client-beta');
    expect(beta.nodes.map((n) => [n.clientId, n.subjectUserId])).toEqual([
      ['client-beta', users.fabio],
    ]);
    expect(crossed.body.errors[0].extensions).toEqual({
      code: 'NOT_FOUND',
      reason: 'ORGANIZATION_NOT_FOUND',
    });
  });
});
