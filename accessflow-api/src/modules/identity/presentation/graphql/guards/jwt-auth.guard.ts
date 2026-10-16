import { InvalidAccessTokenError } from '@/modules/identity/application/errors/invalid-access-token.error';
import {
  AuthenticatedIdentity,
  TokenVerifierPort,
} from '@/modules/identity/application/ports/token-verifier.port';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';

export type AuthenticatedRequest = Request & {
  identity?: AuthenticatedIdentity;
};

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;

  const [scheme, token, ...rest] = header.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0)
    return null;

  return token;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenVerifier: TokenVerifierPort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = GqlExecutionContext.create(context).getContext<{
      req: AuthenticatedRequest;
    }>().req;

    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new InvalidAccessTokenError();

    request.identity = await this.tokenVerifier.verify(token);
    return true;
  }
}
