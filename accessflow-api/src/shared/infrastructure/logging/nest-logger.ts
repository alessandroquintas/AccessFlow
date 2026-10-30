import { Logger } from '@nestjs/common';
import { LoggerPort } from '@/shared/application/ports/logger.port';
import { RequestContextPort } from '@/shared/application/ports/request-context.port';

/**
 * LoggerPort sobre o Logger do Nest, com o `requestId=` à frente de cada
 * mensagem (`-` fora de requisição, como num script). O erro vai como último
 * argumento, para o ConsoleLogger imprimir a pilha.
 */
export class NestLogger extends LoggerPort {
  private readonly logger: Logger;

  constructor(
    context: string,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
    this.logger = new Logger(context);
  }

  warn(message: string): void {
    this.logger.warn(this.withRequestId(message));
  }

  error(message: string, error?: unknown): void {
    if (error === undefined) this.logger.error(this.withRequestId(message));
    else this.logger.error(this.withRequestId(message), error);
  }

  private withRequestId(message: string): string {
    return `requestId=${this.requestContext.requestId() ?? '-'} ${message}`;
  }
}
