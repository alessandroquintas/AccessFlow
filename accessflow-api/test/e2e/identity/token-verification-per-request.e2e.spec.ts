import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger, type INestApplication } from '@nestjs/common';
import { exportJWK, generateKeyPair } from 'jose';
import request from 'supertest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { CognitoTokenVerifier } from '@/modules/identity/infrastructure/cognito/cognito-token.verifier';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';

/** Três campos de topo, todos com o JwtAuthGuard. */
const THREE_FIELDS = '{ a: me { id } b: me { id } c: myOrganizations { id } }';

function graphql(app: INestApplication, token: string) {
  return request(app.getHttpServer())
    .post('/graphql')
    .set({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    })
    .send({ query: THREE_FIELDS });
}

describe('Verificação do token de usuário: uma por requisição (e2e)', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });

  it('consulta com 3 campos de topo: 1 verificação; a seguinte faz a sua', async () => {
    const tokens = new FakeTokenVerifier();
    app = await createTestApp(tokens);
    const prisma = app.get(PrismaService);
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "memberships", "organizations", "users" CASCADE`;
    await prisma.user.create({
      data: { cognitoSub: 'ana', name: 'Ana', email: 'ana@example.com' },
    });
    tokens.register('token-ana', { sub: 'ana' });

    const first = await graphql(app, 'token-ana');
    expect(first.body.errors).toBeUndefined();
    expect(first.body.data.a).toEqual(first.body.data.b);
    expect(tokens.calls).toBe(1);

    await graphql(app, 'token-ana');
    expect(tokens.calls).toBe(2);
  });

  it('token inválido com o verificador real: UNAUTHENTICATED e 1 linha de WARN para os 3 campos', async () => {
    const keys = await generateKeyPair('RS256');
    const jwk = await exportJWK(keys.publicKey);
    const verifier = new CognitoTokenVerifier(
      { userPoolId: 'us-east-1_TestPool1', clientIds: ['client-web'] },
      {
        keys: [{ ...jwk, kid: 'test-kid', alg: 'RS256', use: 'sig' }],
      } as never,
    );
    app = await createTestApp(verifier);
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const res = await graphql(app, 'nao.e.jwt');

    // Os três campos não são nulos: o graphql-js devolve só o primeiro erro.
    // Os três guards rodam em paralelo; a contagem de WARN é a prova.
    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    const fromVerifier = warn.mock.calls.filter((call) =>
      String(call[0]).startsWith('Token de usuário recusado'),
    );
    expect(fromVerifier).toHaveLength(1);
  });
});
