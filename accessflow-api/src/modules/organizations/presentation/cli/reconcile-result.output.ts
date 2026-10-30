import {
  ReconcileOutcome,
  ReconcileResult,
} from '@/modules/organizations/application/use-cases/reconcile-integration-clients.use-case';

/** Lê os argumentos do `npm run reconcile:integrations`: só `--apply`. */
export function parseReconcileArgs(argv: readonly string[]): {
  apply: boolean;
} {
  const unknown = argv.filter((arg) => arg !== '--apply');
  if (unknown.length > 0) {
    throw new Error(
      `Argumento desconhecido: ${unknown.join(' ')}. Use só --apply.`,
    );
  }
  return { apply: argv.includes('--apply') };
}

const STALE_OUTCOME: Record<ReconcileOutcome, string> = {
  pending: 'seria marcada FAILED',
  done: 'marcada FAILED',
  skipped: 'saiu de PROVISIONING antes da trava; nada feito',
  error: 'erro (ver log)',
};

const ORPHAN_OUTCOME: Record<ReconcileOutcome, string> = {
  pending: 'seria apagado',
  done: 'apagado',
  skipped: 'nada feito',
  error: 'erro (ver log)',
};

/** As linhas que o script imprime: ids e contagens, nada mais. */
export function formatReconcileResult(result: ReconcileResult): string[] {
  return [
    result.apply
      ? 'Modo --apply: alterações aplicadas.'
      : 'Simulação (sem --apply): nada foi alterado.',
    ...result.staleProvisioning.map(
      (item) =>
        `PROVISIONING desde ${item.createdAt.toISOString()}: integração ${item.integrationId} (organização ${item.organizationId}), app client ${item.clientIds.length > 0 ? item.clientIds.join(', ') : 'nenhum'}: ${STALE_OUTCOME[item.outcome]}.`,
    ),
    ...result.orphanClients.map(
      (orphan) =>
        `App client sem integração ativa: ${orphan.clientId} (${orphan.name}): ${ORPHAN_OUTCOME[orphan.outcome]}.`,
    ),
    `${result.staleProvisioning.length} integração(ões) presa(s) em PROVISIONING; ${result.orphanClients.length} app client(s) sem integração ativa.`,
  ];
}

/** Algum item falhou: o script sai com código 1. */
export function hasReconcileErrors(result: ReconcileResult): boolean {
  return [...result.staleProvisioning, ...result.orphanClients].some(
    (item) => item.outcome === 'error',
  );
}
