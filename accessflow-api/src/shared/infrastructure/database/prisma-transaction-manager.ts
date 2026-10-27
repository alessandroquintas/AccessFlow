import { Injectable } from '@nestjs/common';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { PrismaClientProvider } from './prisma-client.provider';
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
    // Aninhado: segue na transação ativa, sem abrir outra. O commit ou o
    // rollback acontece quando o `run` mais externo terminar.
    if (this.clients.isInTransaction()) return work();

    return this.prisma.$transaction((tx) => this.clients.bind(tx, work));
  }
}
