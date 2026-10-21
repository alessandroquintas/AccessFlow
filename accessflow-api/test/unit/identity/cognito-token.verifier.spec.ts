import { beforeAll, describe, expect, it } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { CognitoTokenVerifier } from '@/modules/identity/infrastructure/cognito/cognito-token.verifier';
import { InvalidAccessTokenError } from '@/modules/identity/application/errors/invalid-access-token.error';

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;

const USER_POOL_ID = 'us-east-1_TestPool1';
const ISSUER = `https://cognito-idp.us-east-1.amazonaws.com/${USER_POOL_ID}`;
const ALLOWED_CLIENT = 'client-web';
const KID = 'test-kid';

let keys: KeyPair;
let sut: CognitoTokenVerifier;

interface TokenOptions {
  sub?: string;
  issuer?: string;
  tokenUse?: string;
  clientId?: string;
  expiresAt?: number;
  signingKey?: KeyPair['privateKey'];
}

async function signToken(options: TokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    token_use: options.tokenUse ?? 'access',
    client_id: options.clientId ?? ALLOWED_CLIENT,
  })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setSubject(options.sub ?? 'sub-123')
    .setIssuer(options.issuer ?? ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(options.expiresAt ?? now + 300)
    .sign(options.signingKey ?? keys.privateKey);
}

describe('CognitoTokenVerifier', () => {
  beforeAll(async () => {
    keys = await generateKeyPair('RS256');
    const publicJwk = await exportJWK(keys.publicKey);

    sut = new CognitoTokenVerifier(
      { userPoolId: USER_POOL_ID, clientIds: [ALLOWED_CLIENT] },
      { keys: [{ ...publicJwk, kid: KID, alg: 'RS256', use: 'sig' }] } as never,
    );
  });

  it('aceita access token válido e retorna sub e clientId', async () => {
    const token = await signToken();

    const identity = await sut.verify(token);

    expect(identity).toEqual({ sub: 'sub-123', clientId: ALLOWED_CLIENT });
  });

  it('rejeita token expirado', async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const token = await signToken({ expiresAt: past });

    await expect(sut.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('rejeita token assinado por outra chave', async () => {
    const attacker = await generateKeyPair('RS256');
    const token = await signToken({ signingKey: attacker.privateKey });

    await expect(sut.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('rejeita token de outro emissor (outro User Pool)', async () => {
    const token = await signToken({
      issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_OutroPool',
    });

    await expect(sut.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('rejeita ID token enviado no lugar do access token', async () => {
    const token = await signToken({ tokenUse: 'id' });

    await expect(sut.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('rejeita token de App Client fora da allowlist', async () => {
    const token = await signToken({ clientId: 'client-nao-autorizado' });

    await expect(sut.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('rejeita string que não é um JWT', async () => {
    await expect(sut.verify('nao-sou-um-jwt')).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('não aceita allowlist de clients vazia', () => {
    expect(
      () =>
        new CognitoTokenVerifier({ userPoolId: USER_POOL_ID, clientIds: [] }),
    ).toThrow();
  });
});
