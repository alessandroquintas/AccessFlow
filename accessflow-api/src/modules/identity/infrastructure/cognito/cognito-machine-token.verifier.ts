import { Logger } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Jwks } from 'aws-jwt-verify/jwk';
import type { CognitoAccessTokenPayload } from 'aws-jwt-verify/jwt-model';
import {
  AuthenticatedMachine,
  MachineTokenVerifierPort,
} from '../../application/ports/machine-token-verifier.port';
import { InvalidAccessTokenError } from '../../application/errors/invalid-access-token.error';

interface CognitoMachineTokenVerifierOptions {
  userPoolId: string;
  /** COGNITO_CLIENT_IDS: clients de usuário, que nunca valem como máquina. */
  userClientIds: string[];
}

function createVerifier({ userPoolId }: CognitoMachineTokenVerifierOptions) {
  // Sem lista de clients: qualquer app client do pool. Quem pode o quê é
  // decidido pelo vínculo em integration_clients e pelos escopos da rota.
  return CognitoJwtVerifier.create({
    userPoolId,
    tokenUse: 'access',
    clientId: null,
  });
}

/** Recusa com motivo para o log (sem o token). */
class RejectedMachineToken extends Error {}

/**
 * Aceita um access token client credentials de qualquer app client do pool
 * configurado. Além de assinatura, emissor, expiração e `token_use=access`
 * (aws-jwt-verify), exige a forma de um token de máquina do Cognito:
 *
 * - sem `username`: o token client credentials não tem usuário; o de usuário
 *   sempre tem;
 * - `client_id` presente e igual ao `sub`: no client credentials o `sub` é o
 *   próprio app client; no de usuário é o id do usuário;
 * - `client_id` fora de COGNITO_CLIENT_IDS: client de usuário nunca vale como
 *   máquina, mesmo se um dia emitir client credentials.
 *
 * Fonte: "Machine-to-machine access token payload", em
 * https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-access-token.html
 */
export class CognitoMachineTokenVerifier extends MachineTokenVerifierPort {
  private readonly logger = new Logger(CognitoMachineTokenVerifier.name);
  private readonly verifier: ReturnType<typeof createVerifier>;
  private readonly userClientIds: ReadonlySet<string>;

  constructor(options: CognitoMachineTokenVerifierOptions, jwks?: Jwks) {
    super();

    this.verifier = createVerifier(options);
    this.userClientIds = new Set(options.userClientIds);

    // Só usado em teste: injeta as chaves públicas e evita buscar na AWS.
    if (jwks) {
      this.verifier.cacheJwks(jwks);
    }
  }

  async verify(token: string): Promise<AuthenticatedMachine> {
    try {
      const payload = await this.verifier.verify(token);
      const clientId = this.machineClientOf(payload);

      return {
        clientId,
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

  private machineClientOf(payload: CognitoAccessTokenPayload): string {
    // O tipo do aws-jwt-verify é o do token de usuário (username
    // obrigatório); o de máquina não o tem. Lido como registro genérico.
    const claims = payload as unknown as Record<string, unknown>;
    if (claims.username !== undefined) {
      throw new RejectedMachineToken('token de usuário (tem username)');
    }
    const clientId = claims.client_id;
    if (typeof clientId !== 'string' || !clientId) {
      throw new RejectedMachineToken('sem client_id');
    }
    if (claims.sub !== clientId) {
      throw new RejectedMachineToken('sub diferente do client_id');
    }
    if (this.userClientIds.has(clientId)) {
      throw new RejectedMachineToken('client_id é de um client de usuário');
    }
    return clientId;
  }
}
