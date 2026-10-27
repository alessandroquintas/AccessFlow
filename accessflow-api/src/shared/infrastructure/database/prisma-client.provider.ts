import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/** Transação aberta por PrismaTransactionManager no contexto assíncrono. */
export interface ActiveTransaction {
  readonly client: Prisma.TransactionClient;
  /** Preenchido quando um `run` interno falha: a transação não pode ter commit. */
  rollbackOnly?: { cause: unknown };
}

/**
 * Único acesso dos repositórios ao Prisma. Dentro de um
 * PrismaTransactionManager.run, devolve o cliente da transação ativa; fora
 * dele, o cliente padrão. A transação ativa fica aqui, e não no gerenciador,
 * para que todos os repositórios leiam o mesmo contexto.
 */
@Injectable()
export class PrismaClientProvider {
  private readonly transaction = new AsyncLocalStorage<ActiveTransaction>();

  constructor(private readonly prisma: PrismaService) {}

  current(): Prisma.TransactionClient {
    return this.transaction.getStore()?.client ?? this.prisma;
  }

  /** Transação ativa, se houver. Uso do PrismaTransactionManager. */
  active(): ActiveTransaction | undefined {
    return this.transaction.getStore();
  }

  /** Executa `work` com `transaction` como a ativa. Uso do PrismaTransactionManager. */
  bind<T>(transaction: ActiveTransaction, work: () => Promise<T>): Promise<T> {
    return this.transaction.run(transaction, work);
  }
}
