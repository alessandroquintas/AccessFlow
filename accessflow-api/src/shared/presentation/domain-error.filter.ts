import { DomainError } from '@/shared/domain/errors/domain.error';
import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpServer,
  HttpStatus,
  IntrinsicException,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { GqlContextType } from '@nestjs/graphql';
import { GraphQLError } from 'graphql/error';

interface ErrorOutput {
  /** Código textual: `extensions.code` no GraphQL e `error.code` no HTTP. */
  code: string;
  status: HttpStatus;
}

const UNAUTHENTICATED: ErrorOutput = {
  code: 'UNAUTHENTICATED',
  status: HttpStatus.UNAUTHORIZED,
};
const FORBIDDEN: ErrorOutput = {
  code: 'FORBIDDEN',
  status: HttpStatus.FORBIDDEN,
};
const NOT_FOUND: ErrorOutput = {
  code: 'NOT_FOUND',
  status: HttpStatus.NOT_FOUND,
};
const CONFLICT: ErrorOutput = { code: 'CONFLICT', status: HttpStatus.CONFLICT };
const BAD_REQUEST: ErrorOutput = {
  code: 'BAD_REQUEST',
  status: HttpStatus.BAD_REQUEST,
};

const OUTPUT_BY_DOMAIN_CODE: Record<string, ErrorOutput> = {
  INVALID_ACCESS_TOKEN: UNAUTHENTICATED,
  USER_INACTIVE: FORBIDDEN,
  EMAIL_NOT_VERIFIED: FORBIDDEN,
  INSUFFICIENT_SCOPE: FORBIDDEN,
  ORGANIZATION_PERMISSION_DENIED: FORBIDDEN,
  PRIVILEGE_ESCALATION: FORBIDDEN,
  USER_NOT_FOUND: NOT_FOUND,
  ORGANIZATION_NOT_FOUND: NOT_FOUND,
  MEMBER_NOT_FOUND: NOT_FOUND,
  INVITATION_NOT_FOUND: NOT_FOUND,
  ROLE_NOT_FOUND: NOT_FOUND,
  USER_ALREADY_EXISTS: CONFLICT,
  SLUG_ALREADY_TAKEN: CONFLICT,
  LAST_OWNER: CONFLICT,
  INVITATION_LIMIT_REACHED: CONFLICT,
  ALREADY_MEMBER: CONFLICT,
  ROLE_NAME_TAKEN: CONFLICT,
  ROLE_LIMIT_REACHED: CONFLICT,
  SYSTEM_ROLE_IMMUTABLE: CONFLICT,
  ROLE_IN_USE: CONFLICT,
  INVALID_INTEGRATION_CLIENT: BAD_REQUEST,
  INVALID_EMAIL: BAD_REQUEST,
  INVALID_INVITATION: BAD_REQUEST,
  INVALID_ROLE: BAD_REQUEST,
  INVALID_PERMISSION: BAD_REQUEST,
};

function outputFor(error: DomainError): ErrorOutput {
  return OUTPUT_BY_DOMAIN_CODE[error.code] ?? BAD_REQUEST;
}

/**
 * Traduz DomainError para GraphQL e HTTP. Em HTTP também mascara erros
 * inesperados; HttpException do Nest (ex.: rota inexistente) segue o padrão.
 */
@Catch()
export class DomainErrorFilter extends BaseExceptionFilter {
  // Mesmo contexto de log que o Nest usa quando não há filtro.
  private readonly logger = new Logger('ExceptionsHandler');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType<GqlContextType>() === 'graphql') {
      return this.catchGraphql(exception);
    }

    return this.catchHttp(exception, host);
  }

  private catchGraphql(exception: unknown): GraphQLError {
    if (exception instanceof DomainError) {
      return new GraphQLError(exception.message, {
        extensions: {
          code: outputFor(exception).code,
          reason: exception.code,
        },
      });
    }

    // Igual ao Nest sem filtro: registra e repassa; o formatError mascara.
    if (
      exception instanceof Error &&
      !(exception instanceof IntrinsicException)
    ) {
      this.logger.error(exception);
    }
    throw exception;
  }

  private catchHttp(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException || this.isHttpError(exception)) {
      return super.catch(exception, host);
    }

    const response = host.switchToHttp().getResponse<unknown>();

    if (exception instanceof DomainError) {
      const { code, status } = outputFor(exception);

      if (status === HttpStatus.UNAUTHORIZED) {
        this.httpAdapter.setHeader(response, 'WWW-Authenticate', 'Bearer');
      }
      this.httpAdapter.reply(
        response,
        { error: { code, reason: exception.code, message: exception.message } },
        status,
      );
      return;
    }

    this.logger.error(exception);
    this.httpAdapter.reply(
      response,
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro interno do servidor.',
        },
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  private get httpAdapter(): HttpServer {
    return this.applicationRef ?? this.httpAdapterHost!.httpAdapter;
  }
}
