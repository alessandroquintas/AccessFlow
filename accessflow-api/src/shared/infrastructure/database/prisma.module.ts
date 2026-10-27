import { Module } from '@nestjs/common';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { PrismaService } from './prisma.service';
import { PrismaClientProvider } from './prisma-client.provider';
import { PrismaTransactionManager } from './prisma-transaction-manager';

@Module({
  providers: [
    PrismaService,
    PrismaClientProvider,
    { provide: TransactionManager, useClass: PrismaTransactionManager },
  ],
  exports: [PrismaService, PrismaClientProvider, TransactionManager],
})
export class PrismaModule {}
