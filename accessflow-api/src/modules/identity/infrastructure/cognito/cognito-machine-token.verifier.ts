import { Logger } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Jwks } from 'aws-jwt-verify/jwk';
import {
  AuthenticatedMachine,
  MachineTokenVerifierPort,
} from '../../application/ports/machine-token-verifier.port';
import { InvalidAccessTokenError } from '../../application/errors/invalid-access-token.error';

interface CognitoMachineTokenVerifierOptions {
  userPoolId: string;
  clientIds: string[];
}

function createVerifier(options: CognitoMachineTokenVerifierOptions) {
  const { userPoolId, clientIds } = options;

  return CognitoJwtVerifier.create({
    userPoolId,
    tokenUse: 'access',
    clientId: clientIds,
  });
}

export class CognitoMachineTokenVerifier extends MachineTokenVerifierPort {
  private readonly logger = new Logger(CognitoMachineTokenVerifier.name);
  private readonly verifier: ReturnType<typeof createVerifier>;

  constructor(options: CognitoMachineTokenVerifierOptions, jwks?: Jwks) {
    super();

    if (options.clientIds.length === 0) {
      throw new Error(
        'CognitoMachineTokenVerifier exige ao menos um clientId na allowlist',
      );
    }

    this.verifier = createVerifier(options);

    // Só usado em teste: injeta as chaves públicas e evita buscar na AWS.
    if (jwks) {
      this.verifier.cacheJwks(jwks);
    }
  }

  async verify(token: string): Promise<AuthenticatedMachine> {
    try {
      const payload = await this.verifier.verify(token);

      return {
        clientId: payload.client_id,
        scopes: payload.scope?.split(' ').filter(Boolean) ?? [],
      };
    } catch (error) {
      // Só o motivo vai para o log, nunca o token.
      this.logger.warn(
        `Token de máquina recusado: ${error instanceof Error ? error.message : 'motivo desconhecido'}`,
      );
      throw new InvalidAccessTokenError();
    }
  }
}
