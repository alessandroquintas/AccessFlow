import { DomainError } from '@/shared/domain/errors/domain.error';
import { InvalidJsonError } from '@/shared/application/errors/invalid-json.error';
import { MalformedUriError } from '@/shared/application/errors/malformed-uri.error';
import { PayloadTooLargeError } from '@/shared/application/errors/payload-too-large.error';
import { RouteNotFoundError } from '@/shared/application/errors/route-not-found.error';
import { UnsupportedMediaTypeError } from '@/shared/application/errors/unsupported-media-type.error';
import { RequestContextPort } from '@/shared/application/ports/request-context.port';
import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  HttpException,
  HttpStatus,
  IntrinsicException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { HttpServer } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { GqlContextType } from '@nestjs/graphql';
import { GraphQLError } from 'graphql/error';
import { REQUEST_ID_HEADER, resolveRequestId } from './http/request-id';

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
const PAYLOAD_TOO_LARGE: ErrorOutput = {
  code: 'PAYLOAD_TOO_LARGE',
  status: HttpStatus.PAYLOAD_TOO_LARGE,
};
const UNSUPPORTED_MEDIA_TYPE: ErrorOutput = {
  code: 'UNSUPPORTED_MEDIA_TYPE',
  status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
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
  MALFORMED_URI: BAD_REQUEST,
  ROUTE_NOT_FOUND: NOT_FOUND,
  PAYLOAD_TOO_LARGE,
  UNSUPPORTED_MEDIA_TYPE,
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

/** Status de um erro do body-parser (http-errors), se for um. */
function httpErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { status } = error as { status?: unknown };
  return typeof status === 'number' ? status : undefined;
}

/**
 * Erros de transporte, de antes da aplicação, no formato padrão e sem a
 * mensagem de quem os gerou (o parser repete pedaços do corpo, e o 404 do
 * Nest repete o caminho):
 * - corpo JSON ilegível: INVALID_JSON (ver isInvalidJsonBody);
 * - URI malformada: o Nest troca o URIError do roteador por um
 *   BadRequestException, a mesma classe do JSON ilegível. A aplicação não
 *   lança BadRequestException, então o que sobra é a URI;
 * - rota inexistente: o Nest lança NotFoundException; a aplicação também não;
 * - 413 e 415 do body-parser: limite do corpo, Content-Encoding ou charset.
 */
function translateTransportError(
  exception: unknown,
  request: IncomingRequest | undefined,
): unknown {
  if (exception instanceof BadRequestException) {
    return isInvalidJsonBody(exception, request)
      ? new InvalidJsonError()
      : new MalformedUriError();
  }
  if (exception instanceof NotFoundException) return new RouteNotFoundError();

  switch (httpErrorStatus(exception)) {
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return new PayloadTooLargeError();
    case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
      return new UnsupportedMediaTypeError();
    default:
      return exception;
  }
}

/**
 * Traduz DomainError para GraphQL e HTTP. Em HTTP também mascara erros
 * inesperados e responde os erros de transporte no formato padrão (ver
 * translateTransportError); as demais HttpException seguem o padrão do Nest.
 * O erro inesperado vai para o log com o id de correlação da requisição.
 */
@Catch()
export class DomainErrorFilter extends BaseExceptionFilter {
  // Mesmo contexto de log que o Nest usa quando não há filtro.
  private readonly logger = new Logger('ExceptionsHandler');

  constructor(
    private readonly requestContext: RequestContextPort,
    // Só os testes passam; na aplicação o Nest injeta o HttpAdapterHost.
    @Optional() applicationRef?: HttpServer,
  ) {
    super(applicationRef);
  }

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
      this.logUnexpected(exception, this.requestContext.requestId());
    }
    throw exception;
  }

  private catchHttp(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<IncomingRequest | undefined>();
    const response = http.getResponse<unknown>();
    const requestId = this.requestIdFor(request, response);
    const error = translateTransportError(exception, request);

    if (error instanceof HttpException || this.isHttpError(error)) {
      return super.catch(error, host);
    }

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

    this.logUnexpected(error, requestId);
    this.httpAdapter.reply(
      response,
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro interno do servidor.',
          requestId,
        },
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * O id aberto pelo RequestIdMiddleware. O erro anterior a ele (corpo que o
   * body-parser recusou) chega sem contexto: o id sai do cabeçalho aqui, pela
   * mesma regra, para essa resposta também levar o X-Request-Id.
   */
  private requestIdFor(
    request: IncomingRequest | undefined,
    response: unknown,
  ): string {
    const current = this.requestContext.requestId();
    if (current) return current;

    const requestId = resolveRequestId(
      request?.headers?.[REQUEST_ID_HEADER.toLowerCase()],
    );
    if (!this.httpAdapter.isHeadersSent(response)) {
      this.httpAdapter.setHeader(response, REQUEST_ID_HEADER, requestId);
    }
    return requestId;
  }

  /**
   * O id em mensagem própria, antes do erro: com o erro como último argumento,
   * o ConsoleLogger continua imprimindo-o inteiro (com a pilha) e mantém o
   * contexto ExceptionsHandler. Uma string no fim viraria o contexto.
   */
  private logUnexpected(error: unknown, requestId: string | undefined): void {
    this.logger.error(`requestId=${requestId ?? '-'}`, error);
  }

  private get httpAdapter(): HttpServer {
    return this.applicationRef ?? this.httpAdapterHost!.httpAdapter;
  }
}
