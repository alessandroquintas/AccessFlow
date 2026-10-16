import { DomainError } from '@/shared/domain/errors/domain.error';
import { Catch } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql/error';

const GRAPHQL_CODE_BY_DOMAIN_CODE: Record<string, string> = {
  INVALID_ACCESS_TOKEN: 'UNAUTHENTICATED',
  USER_INACTIVE: 'FORBIDDEN',
  USER_NOT_FOUND: 'NOT_FOUND',
};

@Catch(DomainError)
export class DomainErrorFilter implements GqlExceptionFilter {
  catch(error: DomainError) {
    return new GraphQLError(error.message, {
      extensions: {
        code: GRAPHQL_CODE_BY_DOMAIN_CODE[error.code] ?? 'BAD_REQUEST',
        reason: error.code,
      },
    });
  }
}
