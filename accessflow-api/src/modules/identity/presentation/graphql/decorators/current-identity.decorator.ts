import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AuthenticatedRequest } from '../guards/jwt-auth.guard';

export const CurrentIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = GqlExecutionContext.create(context).getContext<{
      req: AuthenticatedRequest;
    }>().req;

    return request.identity;
  },
);
