import { Module } from '@nestjs/common';
import { EnvService } from '@/config/env.service';
import { DatabaseHealthPort } from '@/shared/application/ports/database-health.port';
import { PrismaModule } from '../database/prisma.module';
import { PrismaDatabaseHealth } from '../database/prisma-database-health';
import { ShutdownState } from '../lifecycle/shutdown-state';
import { HealthController } from '@/shared/presentation/http/health.controller';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [
    {
      provide: ShutdownState,
      inject: [EnvService],
      useFactory: (env: EnvService) =>
        new ShutdownState(env.get('SHUTDOWN_DRAIN_SECONDS') * 1000),
    },
    { provide: DatabaseHealthPort, useClass: PrismaDatabaseHealth },
  ],
  exports: [ShutdownState],
})
export class HealthModule {}
