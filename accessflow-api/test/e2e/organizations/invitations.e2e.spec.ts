import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { FakeIdentityProfileProvider } from '@test/fakes/identity/fake-identity-profile-provider';
import { FakeMachineTokenVerifier } from '@test/fakes/identity/fake-machine-token-verifier';
import { FixedClock } from '@test/fakes/shared/fixed-clock';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';

const DAY = 24 * 60 * 60 * 1000;

const PROVISION = `mutation Provision($name: String!) {
  provisionMe(input: { name: $name }) { id }
}`;
const CREATE = `mutation Create($name: String!, $slug: String!) {
  createOrganization(input: { name: $name, slug: $slug }) { id }
}`;
const INVITE = `mutation Invite($orgId: ID!, $email: String!, $role: MembershipRole!) {
  inviteMember(organizationId: $orgId, input: { email: $email, role: $role }) {
    id email role status expiresAt createdAt invitedBy { userId name }
  }
}`;
const ORGANIZATION_INVITATIONS = `query List($orgId: ID!, $first: Int, $after: String) {
  organizationInvitations(organizationId: $orgId, first: $first, after: $after) {
    nodes { id email role status expiresAt invitedBy { userId name } }
    pageInfo { hasNextPage endCursor }
  }
}`;
const REVOKE = `mutation Revoke($orgId: ID!, $id: ID!) {
  revokeInvitation(organizationId: $orgId, invitationId: $id)
}`;
const MY_INVITATIONS = `query {
  myInvitations {
    id role expiresAt invitedByName organization { id name slug }
  }
}`;
const ACCEPT = `mutation Accept($id: ID!) {
  acceptInvitation(invitationId: $id) { id name viewerRole }
}`;
const DECLINE = `mutation Decline($id: ID!) { declineInvitation(invitationId: $id) }`;
const MEMBERS = `query Members($orgId: ID!) {
  organizationMembers(organizationId: $orgId) { nodes { userId role joinedAt } }
}`;
const ORGANIZATION = `query Organization($orgId: ID!) {
  organization(organizationId: $orgId) { id viewerRole }
}`;
const LEAVE = `mutation Leave($orgId: ID!) { leaveOrganization(organizationId: $orgId) }`;

let app: INestApplication;
let prisma: PrismaService;
let tokens: FakeTokenVerifier;
let profiles: FakeIdentityProfileProvider;
let clock: FixedClock;

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

/** Provisiona pelo fluxo real: o e-mail do perfil vem do provedor. */
async function provision(sub: string, name: string, email: string) {
  tokens.register(`token-${sub}`, { sub });
  profiles.register(`token-${sub}`, { sub, email });
  const res = await graphql(PROVISION, { name }, `token-${sub}`);
  expect(res.body.errors).toBeUndefined();
  return res.body.data.provisionMe as { id: string };
}

function expectError(
  res: request.Response,
  extensions: { code: string; reason: string },
) {
  expect(res.body.errors[0].extensions).toEqual(extensions);
}

describe('Convites (e2e)', () => {
  let ana: { id: string };
  let orgId: string;

  async function invite(
    email: string,
    role: 'OWNER' | 'MEMBER' = 'MEMBER',
    token = 'token-ana',
  ) {
    return graphql(INVITE, { orgId, email, role }, token);
  }

  async function inviteOk(email: string, role: 'OWNER' | 'MEMBER' = 'MEMBER') {
    const res = await invite(email, role);
    expect(res.body.errors).toBeUndefined();
    return res.body.data.inviteMember as {
      id: string;
      email: string;
      role: string;
      status: string;
      expiresAt: string;
    };
  }

  async function myInvitations(token: string) {
    const res = await graphql(MY_INVITATIONS, {}, token);
    expect(res.body.errors).toBeUndefined();
    return res.body.data.myInvitations as { id: string }[];
  }

  async function members() {
    const res = await graphql(MEMBERS, { orgId }, 'token-ana');
    expect(res.body.errors).toBeUndefined();
    return res.body.data.organizationMembers.nodes as {
      userId: string;
      role: string;
      joinedAt: string;
    }[];
  }

  beforeAll(async () => {
    tokens = new FakeTokenVerifier();
    profiles = new FakeIdentityProfileProvider();
    clock = new FixedClock();
    app = await createTestApp(
      tokens,
      profiles,
      new FakeMachineTokenVerifier(),
      clock,
    );
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    tokens.reset();
    profiles.reset();
    clock.set(new Date());
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "memberships", "organizations", "users" CASCADE`;

    ana = await provision('ana', 'Ana', 'ana@example.com');
    const res = await graphql(
      CREATE,
      { name: 'Acme', slug: 'acme' },
      'token-ana',
    );
    orgId = res.body.data.createOrganization.id;
  });

  it('fluxo completo: OWNER convida, o convidado vê, aceita e entra com o papel do convite', async () => {
    const bruno = await provision('bruno', 'Bruno', 'bruno@example.com');

    const invitation = await inviteOk('Bruno@Example.com', 'OWNER');
    expect(invitation).toMatchObject({
      email: 'bruno@example.com',
      role: 'OWNER',
      status: 'PENDING',
      expiresAt: new Date(clock.now().getTime() + 7 * DAY).toISOString(),
      invitedBy: { userId: ana.id, name: 'Ana' },
    });

    expect(await myInvitations('token-bruno')).toEqual([
      {
        id: invitation.id,
        role: 'OWNER',
        expiresAt: invitation.expiresAt,
        invitedByName: 'Ana',
        organization: { id: orgId, name: 'Acme', slug: 'acme' },
      },
    ]);

    const accepted = await graphql(
      ACCEPT,
      { id: invitation.id },
      'token-bruno',
    );
    expect(accepted.body.errors).toBeUndefined();
    expect(accepted.body.data.acceptInvitation).toEqual({
      id: orgId,
      name: 'Acme',
      viewerRole: 'OWNER',
    });

    expect(await members()).toContainEqual(
      expect.objectContaining({ userId: bruno.id, role: 'OWNER' }),
    );
    const organization = await graphql(ORGANIZATION, { orgId }, 'token-bruno');
    expect(organization.body.data.organization.viewerRole).toBe('OWNER');

    expect(await myInvitations('token-bruno')).toEqual([]);
    const listed = await graphql(
      ORGANIZATION_INVITATIONS,
      { orgId },
      'token-ana',
    );
    expect(listed.body.data.organizationInvitations.nodes).toEqual([]);
  });

  it('organizationInvitations lista do mais recente para o mais antigo e pagina pelo endCursor', async () => {
    const created: string[] = [];
    for (const email of ['a@example.com', 'b@example.com', 'c@example.com']) {
      created.push((await inviteOk(email)).id);
      clock.advance(1000);
    }

    const first = await graphql(
      ORGANIZATION_INVITATIONS,
      { orgId, first: 2 },
      'token-ana',
    );
    const page1 = first.body.data.organizationInvitations;
    const second = await graphql(
      ORGANIZATION_INVITATIONS,
      { orgId, first: 2, after: page1.pageInfo.endCursor },
      'token-ana',
    );
    const page2 = second.body.data.organizationInvitations;

    expect(page1.pageInfo.hasNextPage).toBe(true);
    expect(page2.pageInfo.hasNextPage).toBe(false);
    expect(
      [...page1.nodes, ...page2.nodes].map((n: { id: string }) => n.id),
    ).toEqual([...created].reverse());
    expect(page1.nodes[0]).toMatchObject({
      status: 'PENDING',
      invitedBy: { userId: ana.id, name: 'Ana' },
    });
  });

  it('recusar: o convite some do myInvitations e ninguém entra', async () => {
    const bruno = await provision('bruno', 'Bruno', 'bruno@example.com');
    const invitation = await inviteOk('bruno@example.com');

    const res = await graphql(DECLINE, { id: invitation.id }, 'token-bruno');

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.declineInvitation).toBe(true);
    expect(await myInvitations('token-bruno')).toEqual([]);
    expect((await members()).map((m) => m.userId)).not.toContain(bruno.id);
    expectError(await graphql(ACCEPT, { id: invitation.id }, 'token-bruno'), {
      code: 'NOT_FOUND',
      reason: 'INVITATION_NOT_FOUND',
    });
  });

  it('revogar: o convite some do myInvitations e não pode mais ser aceito', async () => {
    await provision('bruno', 'Bruno', 'bruno@example.com');
    const invitation = await inviteOk('bruno@example.com');

    const res = await graphql(
      REVOKE,
      { orgId, id: invitation.id },
      'token-ana',
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.revokeInvitation).toBe(true);
    expect(await myInvitations('token-bruno')).toEqual([]);
    expectError(await graphql(ACCEPT, { id: invitation.id }, 'token-bruno'), {
      code: 'NOT_FOUND',
      reason: 'INVITATION_NOT_FOUND',
    });
    expectError(
      await graphql(REVOKE, { orgId, id: invitation.id }, 'token-ana'),
      { code: 'NOT_FOUND', reason: 'INVITATION_NOT_FOUND' },
    );
  });

  it('expirado: não aparece, não pode ser aceito e é listado como EXPIRED', async () => {
    await provision('bruno', 'Bruno', 'bruno@example.com');
    const invitation = await inviteOk('bruno@example.com');

    clock.advance(7 * DAY);

    expect(await myInvitations('token-bruno')).toEqual([]);
    expectError(await graphql(ACCEPT, { id: invitation.id }, 'token-bruno'), {
      code: 'NOT_FOUND',
      reason: 'INVITATION_NOT_FOUND',
    });
    const listed = await graphql(
      ORGANIZATION_INVITATIONS,
      { orgId },
      'token-ana',
    );
    expect(listed.body.data.organizationInvitations.nodes).toMatchObject([
      { id: invitation.id, status: 'EXPIRED' },
    ]);
  });

  it('usuário com outro e-mail não vê, não aceita e não recusa', async () => {
    await provision('bruno', 'Bruno', 'bruno@example.com');
    const carla = await provision('carla', 'Carla', 'carla@example.com');
    const invitation = await inviteOk('bruno@example.com');

    expect(await myInvitations('token-carla')).toEqual([]);
    for (const mutation of [ACCEPT, DECLINE]) {
      expectError(
        await graphql(mutation, { id: invitation.id }, 'token-carla'),
        { code: 'NOT_FOUND', reason: 'INVITATION_NOT_FOUND' },
      );
    }
    expect((await members()).map((m) => m.userId)).not.toContain(carla.id);
    expect(await myInvitations('token-bruno')).toHaveLength(1);
  });

  it('MEMBER não convida nem lista os convites (FORBIDDEN)', async () => {
    const bruno = await provision('bruno', 'Bruno', 'bruno@example.com');
    await prisma.membership.create({
      data: { organizationId: orgId, userId: bruno.id, role: 'MEMBER' },
    });
    const forbidden = {
      code: 'FORBIDDEN',
      reason: 'ORGANIZATION_PERMISSION_DENIED',
    };

    expectError(
      await invite('carla@example.com', 'MEMBER', 'token-bruno'),
      forbidden,
    );
    expectError(
      await graphql(ORGANIZATION_INVITATIONS, { orgId }, 'token-bruno'),
      forbidden,
    );
    expect(await prisma.invitation.count()).toBe(0);
  });

  it.each([
    ['um membro ativo', 'BRUNO@example.com'],
    ['a si mesmo', 'ana@example.com'],
  ])('convidar %s: CONFLICT/ALREADY_MEMBER', async (_cenario, email) => {
    const bruno = await provision('bruno', 'Bruno', 'bruno@example.com');
    await prisma.membership.create({
      data: { organizationId: orgId, userId: bruno.id, role: 'MEMBER' },
    });

    expectError(await invite(email), {
      code: 'CONFLICT',
      reason: 'ALREADY_MEMBER',
    });
    expect(await prisma.invitation.count()).toBe(0);
  });

  it('e-mail inválido: BAD_REQUEST/INVALID_EMAIL', async () => {
    expectError(await invite('bruno@'), {
      code: 'BAD_REQUEST',
      reason: 'INVALID_EMAIL',
    });
  });

  it('reconvite renova: mesmo id, novo papel e nova expiração', async () => {
    const first = await inviteOk('bruno@example.com', 'MEMBER');
    clock.advance(2 * DAY);

    const renewed = await inviteOk('bruno@example.com', 'OWNER');

    expect(renewed.id).toBe(first.id);
    expect(renewed.role).toBe('OWNER');
    expect(renewed.expiresAt).toBe(
      new Date(clock.now().getTime() + 7 * DAY).toISOString(),
    );
    expect(await prisma.invitation.count()).toBe(1);
  });

  it.each([
    ['inviteMember', INVITE, { email: 'a@example.com', role: 'MEMBER' }],
    ['organizationInvitations', ORGANIZATION_INVITATIONS, {}],
    ['revokeInvitation', REVOKE, { id: crypto.randomUUID() }],
    ['myInvitations', MY_INVITATIONS, {}],
    ['acceptInvitation', ACCEPT, { id: crypto.randomUUID() }],
    ['declineInvitation', DECLINE, { id: crypto.randomUUID() }],
  ])('%s sem token: UNAUTHENTICATED', async (_name, query, variables) => {
    const res = await graphql(query, { orgId, ...variables });

    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it('quem sai e é convidado de novo volta com o papel do novo convite', async () => {
    const bruno = await provision('bruno', 'Bruno', 'bruno@example.com');
    const first = await inviteOk('bruno@example.com', 'OWNER');
    await graphql(ACCEPT, { id: first.id }, 'token-bruno');
    const firstJoin = (await members()).find((m) => m.userId === bruno.id)!;

    const left = await graphql(LEAVE, { orgId }, 'token-bruno');
    expect(left.body.data.leaveOrganization).toBe(true);
    clock.advance(DAY);

    const second = await inviteOk('bruno@example.com', 'MEMBER');
    expect(second.id).not.toBe(first.id);
    const accepted = await graphql(ACCEPT, { id: second.id }, 'token-bruno');

    expect(accepted.body.data.acceptInvitation.viewerRole).toBe('MEMBER');
    const again = (await members()).filter((m) => m.userId === bruno.id);
    expect(again).toEqual([
      // joinedAt é a data da primeira entrada.
      { userId: bruno.id, role: 'MEMBER', joinedAt: firstJoin.joinedAt },
    ]);
    expect(await prisma.membership.count({ where: { userId: bruno.id } })).toBe(
      1,
    );
  });
});
