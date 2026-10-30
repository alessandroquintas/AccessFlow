import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { CognitoMachineTokenVerifier } from '@/modules/identity/infrastructure/cognito/cognito-machine-token.verifier';
import { InvalidAccessTokenError } from '@/modules/identity/application/errors/invalid-access-token.error';

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;

const USER_POOL_ID = 'us-east-1_TestPool1';
const ISSUER = `https://cognito-idp.us-east-1.amazonaws.com/${USER_POOL_ID}`;
/** Um client qualquer do pool, que nunca esteve em lista nenhuma. */
const NEW_CLIENT = 'client-novo-7k2';
const USER_CLIENT = 'client-web';
const KID = 'test-kid';

let keys: KeyPair;
let otherKeys: KeyPair;
let sut: CognitoMachineTokenVerifier;

interface TokenOptions {
  tokenUse?: string;
  clientId?: string | null;
  sub?: string;
  username?: string;
  scope?: string | null;
  issuer?: string;
  expiresAt?: number;
  signingKey?: KeyPair['privateKey'];
}

/**
 * Por padrão, como o Cognito emite no client credentials: sub igual ao
 * client_id, sem username, token_use=access, com scope.
 */
async function signToken(options: TokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const clientId =
    options.clientId === undefined ? NEW_CLIENT : options.clientId;
  const scope =
    options.scope === undefined ? 'accessflow-api/members.read' : options.scope;

  return new SignJWT({
    token_use: options.tokenUse ?? 'access',
    ...(clientId !== null && { client_id: clientId }),
    ...(scope !== null && { scope }),
    ...(options.username && { username: options.username }),
    version: 2,
    jti: 'jti-1',
  })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setSubject(options.sub ?? clientId ?? 'sem-client')
    .setIssuer(options.issuer ?? ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(options.expiresAt ?? now + 300)
    .sign(options.signingKey ?? keys.privateKey);
}

describe('CognitoMachineTokenVerifier', () => {
  beforeAll(async () => {
    keys = await generateKeyPair('RS256');
    otherKeys = await generateKeyPair('RS256');
    const publicJwk = await exportJWK(keys.publicKey);

    sut = new CognitoMachineTokenVerifier(
      { userPoolId: USER_POOL_ID, userClientIds: [USER_CLIENT, 'client-cli'] },
      { keys: [{ ...publicJwk, kid: KID, alg: 'RS256', use: 'sig' }] } as never,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('aceita token client credentials de um client que não está em lista nenhuma', async () => {
    const token = await signToken({
      scope: 'accessflow-api/members.read accessflow-api/authorize',
    });

    expect(await sut.verify(token)).toEqual({
      clientId: NEW_CLIENT,
      scopes: ['accessflow-api/members.read', 'accessflow-api/authorize'],
    });
  });

  it('devolve lista vazia quando o token não tem escopos', async () => {
    const token = await signToken({ scope: null });

    expect((await sut.verify(token)).scopes).toEqual([]);
  });

  it.each<[string, TokenOptions, string]>([
    [
      'client de usuário (COGNITO_CLIENT_IDS), mesmo com a forma de máquina',
      { clientId: USER_CLIENT },
      'client_id é de um client de usuário',
    ],
    [
      'token de usuário: tem username e o sub é o do usuário',
      {
        clientId: USER_CLIENT,
        sub: '8f1e2d3c-usuario',
        username: 'ana',
      },
      'tem username',
    ],
    [
      'username num token com sub igual ao client_id',
      { username: 'ana' },
      'tem username',
    ],
    [
      'sub diferente do client_id',
      { sub: 'outro-sub' },
      'sub diferente do client_id',
    ],
    ['sem client_id', { clientId: null, sub: 'qualquer' }, ''],
    ['ID token (token_use=id)', { tokenUse: 'id' }, ''],
    [
      'outro pool (emissor diferente)',
      {
        issuer:
          'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_OutroPool',
      },
      '',
    ],
    ['assinado por outra chave', {}, ''],
    ['expirado', { expiresAt: Math.floor(Date.now() / 1000) - 60 }, ''],
  ])('recusa (401): %s', async (scenario, options, reason) => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const token = await signToken(
      scenario === 'assinado por outra chave'
        ? { signingKey: otherKeys.privateKey }
        : options,
    );

    await expect(sut.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toMatch(/^Token de máquina recusado: /);
    expect(line).toContain(reason);
    expect(line).not.toContain(token);
  });
});
