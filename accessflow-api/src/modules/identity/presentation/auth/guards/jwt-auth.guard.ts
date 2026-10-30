import { InvalidAccessTokenError } from '@/modules/identity/application/errors/invalid-access-token.error';
import {
  AuthenticatedIdentity,
  TokenVerifierPort,
} from '@/modules/identity/application/ports/token-verifier.port';
import { getRequest } from '@/shared/presentation/get-request';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../authenticated-request';
import { extractBearerToken } from '../bearer-token';

/**
 * A verificação de cada requisição. No GraphQL o guard roda uma vez por campo
 * de topo, e os campos de uma query rodam em paralelo: guardar a promessa (e
 * não o resultado) faz todos esperarem a mesma verificação. Fica fora da
 * instância porque o Nest cria um guard por módulo (resolvers de módulos
 * diferentes na mesma query). Some com a requisição.
 */
const verifications = new WeakMap<
  object,
  { token: string; identity: Promise<AuthenticatedIdentity> }
>();

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenVerifier: TokenVerifierPort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequest<AuthenticatedRequest>(context);

    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new InvalidAccessTokenError();

    request.identity = await this.verify(request, token);
    request.accessToken = token;
    return true;
  }

  private verify(
    request: AuthenticatedRequest,
    token: string,
  ): Promise<AuthenticatedIdentity> {
    const done = verifications.get(request);
    if (done?.token === token) return done.identity;

    const identity = this.tokenVerifier.verify(token);
    verifications.set(request, { token, identity });
    return identity;
  }
}
