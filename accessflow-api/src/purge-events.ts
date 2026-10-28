import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { EventRetentionModule } from './modules/organizations/event-retention.module';
import { PurgeExpiredEventsUseCase } from './modules/organizations/application/use-cases/purge-expired-events.use-case';
import { formatPurgeResult } from './modules/organizations/presentation/cli/purge-result.output';

/**
 * `npm run purge:events` (depois do build): apaga as decisões do authorize e
 * os eventos de segurança fora da retenção e imprime as contagens. Contexto
 * Nest sem servidor HTTP; o agendamento fica com a infraestrutura.
 */
async function purgeEvents(): Promise<void> {
  const logger = new Logger('PurgeEvents');
  const app = await NestFactory.createApplicationContext(EventRetentionModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const result = await app.get(PurgeExpiredEventsUseCase).execute();
    for (const line of formatPurgeResult(result)) logger.log(line);
  } finally {
    await app.close();
  }
}

purgeEvents().catch((error: unknown) => {
  new Logger('PurgeEvents').error('Expurgo interrompido.', error);
  process.exitCode = 1;
});
