import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { RequestContextPort } from '@/shared/application/ports/request-context.port';

interface RequestContext {
  requestId: string;
}

/** Contexto por requisição em AsyncLocalStorage: cada uma vê só o seu. */
@Injectable()
export class AsyncLocalRequestContext extends RequestContextPort {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  requestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }

  /** Executa `work` (e o que ele disparar) dentro do contexto informado. */
  run<T>(context: RequestContext, work: () => T): T {
    return this.storage.run(context, work);
  }
}
