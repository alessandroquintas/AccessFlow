import { describe, expect, it } from 'vitest';
import {
  formatReconcileResult,
  hasReconcileErrors,
  parseReconcileArgs,
} from '@/modules/organizations/presentation/cli/reconcile-result.output';
import { ReconcileResult } from '@/modules/organizations/application/use-cases/reconcile-integration-clients.use-case';

const CREATED_AT = new Date('2026-03-01T11:00:00.000Z');

function result(overrides: Partial<ReconcileResult> = {}): ReconcileResult {
  return {
    apply: false,
    staleProvisioning: [
      {
        integrationId: 'int-1',
        organizationId: 'org-1',
        createdAt: CREATED_AT,
        clientIds: ['c-1'],
        outcome: 'pending',
      },
      {
        integrationId: 'int-2',
        organizationId: 'org-2',
        createdAt: CREATED_AT,
        clientIds: [],
        outcome: 'pending',
      },
    ],
    orphanClients: [
      { clientId: 'c-9', name: 'accessflow-int-x', outcome: 'pending' },
    ],
    ...overrides,
  };
}

describe('npm run reconcile:integrations', () => {
  it('sem argumentos simula; --apply aplica', () => {
    expect(parseReconcileArgs([])).toEqual({ apply: false });
    expect(parseReconcileArgs(['--apply'])).toEqual({ apply: true });
  });

  it.each([['--aply'], ['--apply', '--force'], ['apply']])(
    'argumento desconhecido (%s) interrompe antes de qualquer coisa',
    (...argv) => {
      expect(() => parseReconcileArgs(argv)).toThrow(/Argumento desconhecido/);
    },
  );

  it('simulação: diz que nada mudou e o que seria feito', () => {
    expect(formatReconcileResult(result())).toEqual([
      'Simulação (sem --apply): nada foi alterado.',
      'PROVISIONING desde 2026-03-01T11:00:00.000Z: integração int-1 (organização org-1), app client c-1: seria marcada FAILED.',
      'PROVISIONING desde 2026-03-01T11:00:00.000Z: integração int-2 (organização org-2), app client nenhum: seria marcada FAILED.',
      'App client sem integração ativa: c-9 (accessflow-int-x): seria apagado.',
      '2 integração(ões) presa(s) em PROVISIONING; 1 app client(s) sem integração ativa.',
    ]);
    expect(hasReconcileErrors(result())).toBe(false);
  });

  it('apply: o resultado de cada item; erro em qualquer um faz o script sair com 1', () => {
    const applied = result({
      apply: true,
      staleProvisioning: [
        { ...result().staleProvisioning[0], outcome: 'done' },
        { ...result().staleProvisioning[1], outcome: 'skipped' },
      ],
      orphanClients: [{ ...result().orphanClients[0], outcome: 'error' }],
    });

    expect(formatReconcileResult(applied)).toEqual([
      'Modo --apply: alterações aplicadas.',
      'PROVISIONING desde 2026-03-01T11:00:00.000Z: integração int-1 (organização org-1), app client c-1: marcada FAILED.',
      'PROVISIONING desde 2026-03-01T11:00:00.000Z: integração int-2 (organização org-2), app client nenhum: saiu de PROVISIONING antes da trava; nada feito.',
      'App client sem integração ativa: c-9 (accessflow-int-x): erro (ver log).',
      '2 integração(ões) presa(s) em PROVISIONING; 1 app client(s) sem integração ativa.',
    ]);
    expect(hasReconcileErrors(applied)).toBe(true);
  });
});
