import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getRequest } from '@/shared/presentation/get-request';
import type { AuthenticatedRequest } from '../authenticated-request';

export const CurrentIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    return getRequest<AuthenticatedRequest>(context).identity;
  },
);
