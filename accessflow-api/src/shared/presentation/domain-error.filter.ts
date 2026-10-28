import { DomainError } from '@/shared/domain/errors/domain.error';
import { InvalidJsonError } from '@/shared/application/errors/invalid-json.error';
import {
  ArgumentsHost,
  BadRequestException,
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
  PERMISSION_NOT_FOUND: NOT_FOUND,
  USER_ALREADY_EXISTS: CONFLICT,
  SLUG_ALREADY_TAKEN: CONFLICT,
  LAST_OWNER: CONFLICT,
  INVITATION_LIMIT_REACHED: CONFLICT,
  ALREADY_MEMBER: CONFLICT,
  ROLE_NAME_TAKEN: CONFLICT,
  ROLE_LIMIT_REACHED: CONFLICT,
  SYSTEM_ROLE_IMMUTABLE: CONFLICT,
  ROLE_IN_USE: CONFLICT,
  PERMISSION_KEY_TAKEN: CONFLICT,
  PERMISSION_LIMIT_REACHED: CONFLICT,
  PERMISSION_IN_USE: CONFLICT,
  INVALID_INTEGRATION_CLIENT: BAD_REQUEST,
  INVALID_EMAIL: BAD_REQUEST,
  INVALID_INVITATION: BAD_REQUEST,
  INVALID_ROLE: BAD_REQUEST,
  INVALID_PERMISSION: BAD_REQUEST,
  INVALID_PERMISSION_KEY: BAD_REQUEST,
  INVALID_PERMISSION_DESCRIPTION: BAD_REQUEST,
  RESERVED_PERMISSION_RESOURCE: BAD_REQUEST,
  INVALID_CUSTOM_PERMISSION: BAD_REQUEST,
  INVALID_AUTHORIZATION_REQUEST: BAD_REQUEST,
  INVALID_JSON: BAD_REQUEST,
  INVALID_AUDIT_FILTER: BAD_REQUEST,
};

function outputFor(error: DomainError): ErrorOutput {
  return OUTPUT_BY_DOMAIN_CODE[error.code] ?? BAD_REQUEST;
}

interface IncomingRequest {
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

/**
 * Corpo JSON que o body-parser não conseguiu ler. O Nest troca o SyntaxError
 * do parser por um BadRequestException com a mensagem dele e sem `cause`
 * (RoutesResolver.mapExternalException), então o caso é reconhecido pelo
 * estado em que o parser deixa a requisição: corpo JSON enviado e `body`
 * ainda sem valor. A aplicação não lança BadRequestException em nenhum lugar.
 */
function isInvalidJsonBody(
  exception: unknown,
  request: IncomingRequest | undefined,
): boolean {
  if (!(exception instanceof BadRequestException)) return false;

  const headers = request?.headers ?? {};
  const isJson = /^application\/json\s*(;|$)/i.test(
    String(headers['content-type'] ?? ''),
  );
  const hasBody =
    headers['transfer-encoding'] !== undefined ||
    Number(headers['content-length'] ?? 0) > 0;

  return isJson && hasBody && request?.body === undefined;
}

/**
 * Traduz DomainError para GraphQL e HTTP. Em HTTP também mascara erros
 * inesperados e responde JSON inválido no formato padrão; as demais
 * HttpException do Nest (ex.: rota inexistente) seguem o padrão do Nest.
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
    const http = host.switchToHttp();
    // Sem o texto do parser: ele repete pedaços do corpo recebido.
    const error = isInvalidJsonBody(
      exception,
      http.getRequest<IncomingRequest | undefined>(),
    )
      ? new InvalidJsonError()
      : exception;

    if (error instanceof HttpException || this.isHttpError(error)) {
      return super.catch(error, host);
    }

    const response = http.getResponse<unknown>();

    if (error instanceof DomainError) {
      const { code, status } = outputFor(error);

      if (status === HttpStatus.UNAUTHORIZED) {
        this.httpAdapter.setHeader(response, 'WWW-Authenticate', 'Bearer');
      }
      this.httpAdapter.reply(
        response,
        { error: { code, reason: error.code, message: error.message } },
        status,
      );
      return;
    }

    this.logger.error(error);
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
