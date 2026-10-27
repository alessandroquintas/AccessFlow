import { Injectable } from '@nestjs/common';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { TransactionRolledBackError } from '@/shared/application/errors/transaction-rolled-back.error';
import {
  ActiveTransaction,
  PrismaClientProvider,
} from './prisma-client.provider';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaTransactionManager extends TransactionManager {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: PrismaClientProvider,
  ) {
    super();
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    const active = this.clients.active();
    if (active) return this.runNested(active, work);

    return this.prisma.$transaction(async (client) => {
      const transaction: ActiveTransaction = { client };
      const result = await this.clients.bind(transaction, work);

      // Lançar aqui faz o Prisma desfazer a transação em vez do commit.
      if (transaction.rollbackOnly) {
        throw new TransactionRolledBackError(transaction.rollbackOnly.cause);
      }
      return result;
    });
  }

  /**
   * Segue na transação ativa, sem abrir outra. Se falhar, marca a transação
   * inteira: quem chamou pode capturar o erro, mas o commit não acontece.
   */
  private async runNested<T>(
    transaction: ActiveTransaction,
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      return await work();
    } catch (error) {
      transaction.rollbackOnly ??= { cause: error };
      throw error;
    }
  }
}
