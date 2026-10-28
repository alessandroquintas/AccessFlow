import { Module } from '@nestjs/common';
import { RequestContextPort } from '@/shared/application/ports/request-context.port';
import { AsyncLocalRequestContext } from './async-local-request-context';

/**
 * Uma instância só para a aplicação toda: o middleware abre o contexto pela
 * classe concreta e os demais leem pela porta.
 */
@Module({
  providers: [
    AsyncLocalRequestContext,
    { provide: RequestContextPort, useExisting: AsyncLocalRequestContext },
  ],
  exports: [AsyncLocalRequestContext, RequestContextPort],
})
export class RequestContextModule {}
