import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthenticatedRequest } from '../guards/jwt-auth.guard';

export const CurrentAccessToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    return GqlExecutionContext.create(context).getContext<{
      req: AuthenticatedRequest;
    }>().req.accessToken;
  },
);
