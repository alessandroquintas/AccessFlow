import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  AuthenticatedIdentity,
  TokenVerifierPort,
} from '../../application/ports/token-verifier.port';
import { Jwks } from 'aws-jwt-verify/jwk';
import { InvalidAccessTokenError } from '../../application/errors/invalid-access-token.error';

interface CognitoTokenVerifierOptions {
  userPoolId: string;
  clientIds: string[];
}

function createVerifier(options: CognitoTokenVerifierOptions) {
  const { userPoolId, clientIds } = options;

  return CognitoJwtVerifier.create({
    userPoolId,
    tokenUse: 'access',
    clientId: clientIds,
  });
}

export class CognitoTokenVerifier extends TokenVerifierPort {
  private readonly verifier: ReturnType<typeof createVerifier>;

  constructor(options: CognitoTokenVerifierOptions, jwks?: Jwks) {
    super();

    if (options.clientIds.length === 0) {
      throw new Error(
        'CognitoTokenVerifier exige ao menos um clientId na allowlist',
      );
    }

    this.verifier = createVerifier(options);

    // Só usando em teste: injeta as chaves publicas e evita buscar na AWS;
    if (jwks) {
      this.verifier.cacheJwks(jwks);
    }
  }

  async verify(token: string): Promise<AuthenticatedIdentity> {
    try {
      const payload = await this.verifier.verify(token);

      return {
        sub: payload.sub,
        clientId: payload.client_id,
      };
    } catch {
      throw new InvalidAccessTokenError();
    }
  }
}
