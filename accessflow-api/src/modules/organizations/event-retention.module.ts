import { Module } from '@nestjs/common';
import { PrismaModule } from '@/shared/infrastructure/database/prisma.module';
import { EventRetention } from './domain/repositories/event-retention.repository';
import { PrismaEventRetention } from './infrastructure/persistence/prisma-event-retention';
import { PurgeExpiredEventsUseCase } from './application/use-cases/purge-expired-events.use-case';

/**
 * Só o necessário para o expurgo (npm run purge:events): sem HTTP, GraphQL
 * nem a configuração do Cognito.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    { provide: EventRetention, useClass: PrismaEventRetention },
    {
      provide: PurgeExpiredEventsUseCase,
      inject: [EventRetention],
      useFactory: (retention: EventRetention) =>
        new PurgeExpiredEventsUseCase(retention),
    },
  ],
})
export class EventRetentionModule {}
