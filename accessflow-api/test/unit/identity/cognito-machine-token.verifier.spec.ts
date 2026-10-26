import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { CognitoMachineTokenVerifier } from '@/modules/identity/infrastructure/cognito/cognito-machine-token.verifier';
import { InvalidAccessTokenError } from '@/modules/identity/application/errors/invalid-access-token.error';

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;

const USER_POOL_ID = 'us-east-1_TestPool1';
const ISSUER = `https://cognito-idp.us-east-1.amazonaws.com/${USER_POOL_ID}`;
const MACHINE_CLIENT = 'client-integracao';
const KID = 'test-kid';

let keys: KeyPair;
let sut: CognitoMachineTokenVerifier;

interface TokenOptions {
  tokenUse?: string;
  clientId?: string;
  scope?: string | null;
  expiresAt?: number;
}

async function signToken(options: TokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const clientId = options.clientId ?? MACHINE_CLIENT;
  const scope =
    options.scope === undefined ? 'accessflow-api/members.read' : options.scope;

  return new SignJWT({
    token_use: options.tokenUse ?? 'access',
    client_id: clientId,
    ...(scope !== null && { scope }),
  })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setSubject(clientId)
    .setIssuer(ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(options.expiresAt ?? now + 300)
    .sign(keys.privateKey);
}

describe('CognitoMachineTokenVerifier', () => {
  beforeAll(async () => {
    keys = await generateKeyPair('RS256');
    const publicJwk = await exportJWK(keys.publicKey);

    sut = new CognitoMachineTokenVerifier(
      { userPoolId: USER_POOL_ID, clientIds: [MACHINE_CLIENT] },
      { keys: [{ ...publicJwk, kid: KID, alg: 'RS256', use: 'sig' }] } as never,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('aceita token de máquina e devolve clientId e escopos', async () => {
    const token = await signToken({
      scope: 'accessflow-api/members.read accessflow-api/outro',
    });

    expect(await sut.verify(token)).toEqual({
      clientId: MACHINE_CLIENT,
      scopes: ['accessflow-api/members.read', 'accessflow-api/outro'],
    });
  });

  it('devolve lista vazia quando o token não tem escopos', async () => {
    const token = await signToken({ scope: null });

    expect((await sut.verify(token)).scopes).toEqual([]);
  });

  it.each([
    [
      'client de usuário (fora da allowlist de máquina)',
      { clientId: 'client-web' },
    ],
    ['ID token no lugar do access token', { tokenUse: 'id' }],
    ['token expirado', { expiresAt: Math.floor(Date.now() / 1000) - 60 }],
  ])('rejeita %s', async (_cenario, options) => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const token = await signToken(options);

    await expect(sut.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('registra o motivo da recusa sem o token', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const token = await signToken({ clientId: 'client-web' });

    await expect(sut.verify(token)).rejects.toThrow();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).not.toContain(token);
  });

  it('não aceita allowlist de clients vazia', () => {
    expect(
      () =>
        new CognitoMachineTokenVerifier({
          userPoolId: USER_POOL_ID,
          clientIds: [],
        }),
    ).toThrow();
  });
});
