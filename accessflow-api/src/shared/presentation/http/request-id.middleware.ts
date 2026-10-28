import type { IncomingMessage, ServerResponse } from 'node:http';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { AsyncLocalRequestContext } from '@/shared/infrastructure/request-context/async-local-request-context';
import { REQUEST_ID_HEADER, resolveRequestId } from './request-id';

/**
 * Define o id de correlação, devolve-o no cabeçalho e abre o contexto da
 * requisição. É middleware, e não interceptor, porque precisa valer antes
 * dos guards (o 401 e o 403 também levam o id) e para o /graphql inteiro.
 * O Nest o registra depois do body-parser: o corpo que não é JSON válido
 * nunca chega aqui, e o DomainErrorFilter cuida desse caso.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(private readonly context: AsyncLocalRequestContext) {}

  use(req: IncomingMessage, res: ServerResponse, next: () => void): void {
    const requestId = resolveRequestId(
      req.headers[REQUEST_ID_HEADER.toLowerCase()],
    );
    res.setHeader(REQUEST_ID_HEADER, requestId);
    this.context.run({ requestId }, next);
  }
}
