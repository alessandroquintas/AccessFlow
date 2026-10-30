import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IntegrationReconciliationModule } from './modules/organizations/integration-reconciliation.module';
import { ReconcileIntegrationClientsUseCase } from './modules/organizations/application/use-cases/reconcile-integration-clients.use-case';
import {
  formatReconcileResult,
  hasReconcileErrors,
  parseReconcileArgs,
} from './modules/organizations/presentation/cli/reconcile-result.output';

/**
 * `npm run reconcile:integrations [-- --apply]` (depois do build): acerta os
 * app clients `accessflow-int-*` do Cognito com o banco. Sem `--apply`, só
 * lista. Contexto Nest sem servidor HTTP.
 */
async function reconcileIntegrations(): Promise<void> {
  const logger = new Logger('ReconcileIntegrations');
  const args = parseReconcileArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(
    IntegrationReconciliationModule,
    { logger: ['log', 'warn', 'error'] },
  );
  try {
    const result = await app
      .get(ReconcileIntegrationClientsUseCase)
      .execute(args);
    for (const line of formatReconcileResult(result)) logger.log(line);
    if (hasReconcileErrors(result)) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

reconcileIntegrations().catch((error: unknown) => {
  new Logger('ReconcileIntegrations').error(
    'Reconciliação interrompida.',
    error,
  );
  process.exitCode = 1;
});
