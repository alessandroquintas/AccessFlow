import { InvalidAccessTokenError } from '@/modules/identity/application/errors/invalid-access-token.error';
import { TokenVerifierPort } from '@/modules/identity/application/ports/token-verifier.port';
import { getRequest } from '@/shared/presentation/get-request';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../authenticated-request';
import { extractBearerToken } from '../bearer-token';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenVerifier: TokenVerifierPort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequest<AuthenticatedRequest>(context);

    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new InvalidAccessTokenError();

    request.identity = await this.tokenVerifier.verify(token);
    request.accessToken = token;
    return true;
  }
}
