import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/**
 * Único acesso dos repositórios ao Prisma. Dentro de um
 * PrismaTransactionManager.run, devolve o cliente da transação ativa; fora
 * dele, o cliente padrão. A transação ativa fica aqui, e não no gerenciador,
 * para que todos os repositórios leiam o mesmo contexto.
 */
@Injectable()
export class PrismaClientProvider {
  private readonly transaction =
    new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(private readonly prisma: PrismaService) {}

  current(): Prisma.TransactionClient {
    return this.transaction.getStore() ?? this.prisma;
  }

  isInTransaction(): boolean {
    return this.transaction.getStore() !== undefined;
  }

  /** Executa `work` com `tx` como cliente atual. Uso do PrismaTransactionManager. */
  bind<T>(tx: Prisma.TransactionClient, work: () => Promise<T>): Promise<T> {
    return this.transaction.run(tx, work);
  }
}
