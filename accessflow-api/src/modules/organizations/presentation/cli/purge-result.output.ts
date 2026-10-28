import {
  PurgedTable,
  PurgeResult,
} from '@/modules/organizations/application/use-cases/purge-expired-events.use-case';

/** As linhas que o `npm run purge:events` imprime: só contagens. */
export function formatPurgeResult(result: PurgeResult): string[] {
  return [
    line('authorization_decisions', result.authorizationDecisions),
    line('security_events', result.securityEvents),
  ];
}

function line(table: string, { deleted, batches, retentionDays }: PurgedTable) {
  return `${table}: ${deleted} apagada(s) em ${batches} lote(s); retenção de ${retentionDays} dias.`;
}
