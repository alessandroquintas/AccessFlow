import type { ExecutionContext } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';

/** Requisição HTTP de origem, seja a chamada um resolver GraphQL ou uma rota REST. */
export function getRequest<T = Request>(context: ExecutionContext): T {
  if (context.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<{ req: T }>().req;
  }

  return context.switchToHttp().getRequest<T>();
}
