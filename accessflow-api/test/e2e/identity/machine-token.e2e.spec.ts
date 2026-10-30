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
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { CognitoMachineTokenVerifier } from '@/modules/identity/infrastructure/cognito/cognito-machine-token.verifier';
import { MachineScope } from '@/modules/identity/presentation/auth/machine-scope';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { FakeIdentityProfileProvider } from '@test/fakes/identity/fake-identity-profile-provider';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';
import { seedOrganization } from '@test/factory/organizations/seed-organization';

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;

const POOL = 'us-east-1_TestPool1';
const ISSUER = `https://cognito-idp.us-east-1.amazonaws.com/${POOL}`;
const USER_CLIENT = 'client-web';
/** Fora de qualquer lista: só o vínculo no banco o autoriza. */
const NEW_CLIENT = 'client-novo-7k2';
const UNBOUND_CLIENT = 'client-sem-vinculo';
const SCOPES = `${MachineScope.MEMBERS_READ} ${MachineScope.AUTHORIZE}`;

let app: INestApplication;
let prisma: PrismaService;
let keys: KeyPair;
let orgId: string;
let anaId: string;

async function token(
  options: {
    clientId?: string;
    sub?: string;
    username?: string;
    tokenUse?: string;
    issuer?: string;
  } = {},
) {
  const clientId = options.clientId ?? NEW_CLIENT;
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    token_use: options.tokenUse ?? 'access',
    client_id: clientId,
    scope: SCOPES,
    ...(options.username && { username: options.username }),
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setSubject(options.sub ?? clientId)
    .setIssuer(options.issuer ?? ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(keys.privateKey);
}

const getMember = (bearer: string) =>
  request(app.getHttpServer())
    .get(`/v1/organizations/${orgId}/members/${anaId}`)
    .set('Authorization', `Bearer ${bearer}`);

describe('Token de máquina sem lista fixa de clients (e2e, verificador real)', () => {
  beforeAll(async () => {
    keys = await generateKeyPair('RS256');
    const jwk = await exportJWK(keys.publicKey);
    app = await createTestApp(
      new FakeTokenVerifier(),
      new FakeIdentityProfileProvider(),
      new CognitoMachineTokenVerifier(
        { userPoolId: POOL, userClientIds: [USER_CLIENT] },
        {
          keys: [{ ...jwk, kid: 'test-kid', alg: 'RS256', use: 'sig' }],
        } as never,
      ),
    );
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await prisma.$executeRaw`TRUNCATE TABLE "security_events", "authorization_decisions", "invitations", "integration_clients", "memberships", "organizations", "users" CASCADE`;
    anaId = (
      await prisma.user.create({
        data: { cognitoSub: 'ana', name: 'Ana', email: 'ana@example.com' },
      })
    ).id;
    orgId = (await seedOrganization(prisma, { slug: 'acme', owner: anaId })).id;
    await prisma.integrationClient.create({
      data: { clientId: NEW_CLIENT, organizationId: orgId, name: 'ERP novo' },
    });
  });

  it('client novo, fora de qualquer lista, com vínculo ACTIVE: aceito no GET de membros e no authorize', async () => {
    const bearer = await token();

    const member = await getMember(bearer);
    const authorize = await request(app.getHttpServer())
      .post('/v1/authorize')
      .set('Authorization', `Bearer ${bearer}`)
      .send({
        organizationId: orgId,
        userId: anaId,
        permissions: ['members:read'],
      });

    expect(member.status).toBe(200);
    expect(authorize.status).toBe(200);
    expect(authorize.body.allowed).toBe(true);
  });

  it('client sem vínculo: autentica, mas recebe o 404 de sempre e gera machine.organization_denied', async () => {
    const res = await getMember(await token({ clientId: UNBOUND_CLIENT }));

    expect(res.status).toBe(404);
    expect(res.body.error.reason).toBe('ORGANIZATION_NOT_FOUND');
    expect(
      await prisma.securityEvent.findMany({
        select: { event: true, actorClientId: true, organizationId: true },
      }),
    ).toEqual([
      {
        event: 'machine.organization_denied',
        actorClientId: UNBOUND_CLIENT,
        organizationId: null,
      },
    ]);
  });

  it.each([
    ['token de client de usuário', { clientId: USER_CLIENT }],
    ['ID token (token_use=id)', { tokenUse: 'id' }],
    ['token com username', { username: 'ana' }],
    [
      'token de outro pool',
      {
        issuer:
          'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_OutroPool',
      },
    ],
  ])('%s: 401, sem evento de segurança', async (_, options) => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const res = await getMember(await token(options));

    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(await prisma.securityEvent.count()).toBe(0);
  });
});
