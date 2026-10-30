import { ClockPort } from '@/shared/application/ports/clock.port';
import { LoggerPort } from '@/shared/application/ports/logger.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { IntegrationClientRepository } from '../../domain/repositories/integration-client.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import {
  MACHINE_CLIENT_NAME_PREFIX,
  MachineClientProvisioner,
  MachineClientSummary,
  machineClientName,
} from '../ports/machine-client-provisioner.port';
import { failProvisioning } from '../services/fail-provisioning';

/** Uma criação leva segundos; em PROVISIONING há mais tempo, a API caiu no meio. */
export const STALE_PROVISIONING_MS = 15 * 60 * 1000;

/**
 * - pending: só listado (sem --apply);
 * - done: marcada FAILED / app client apagado;
 * - skipped: saiu de PROVISIONING antes da trava; nada foi feito;
 * - error: falhou; o detalhe está no log, e a próxima execução tenta de novo.
 */
export type ReconcileOutcome = 'pending' | 'done' | 'skipped' | 'error';

export interface StaleProvisioning {
  integrationId: string;
  organizationId: string;
  createdAt: Date;
  /** App clients `accessflow-int-<id>` dela no Cognito (em geral, nenhum). */
  clientIds: string[];
  outcome: ReconcileOutcome;
}

export interface OrphanMachineClient extends MachineClientSummary {
  outcome: ReconcileOutcome;
}

export interface ReconcileResult {
  apply: boolean;
  staleProvisioning: StaleProvisioning[];
  orphanClients: OrphanMachineClient[];
}

/**
 * Acerta o Cognito e o banco depois de falhas no meio da criação ou da
 * revogação. Sem `apply`, só lista.
 *
 * - Linha em PROVISIONING há mais de 15 minutos: vira FAILED, sob a trava
 *   da organização, e o app client `accessflow-int-<id>`, se existir, é
 *   apagado. Se ela tiver sido ativada antes da trava, nada é feito.
 * - App client `accessflow-int-*` sem linha ACTIVE com o client_id dele: é
 *   apagado. Os de uma linha em PROVISIONING recente ficam (a criação pode
 *   estar no passo 3).
 *
 * Clients sem o prefixo nunca são listados, e portanto nunca apagados.
 */
export class ReconcileIntegrationClientsUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly integrationClients: IntegrationClientRepository,
    private readonly machineClients: MachineClientProvisioner,
    private readonly transactions: TransactionManager,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute({ apply }: { apply: boolean }): Promise<ReconcileResult> {
    // O Cognito antes do banco: um client listado de uma criação em curso
    // aparece no banco como PROVISIONING ou, se ela terminou, como ACTIVE.
    const clients = await this.machineClients.listByPrefix(
      MACHINE_CLIENT_NAME_PREFIX,
    );
    const provisioning = await this.integrationClients.listProvisioning();

    const cutoff = this.clock.now().getTime() - STALE_PROVISIONING_MS;
    const stale = provisioning.filter((i) => i.createdAt.getTime() < cutoff);
    const provisioningNames = new Set(
      provisioning.map((i) => machineClientName(i.id)),
    );

    const staleProvisioning: StaleProvisioning[] = stale.map((i) => ({
      integrationId: i.id,
      organizationId: i.organizationId,
      createdAt: i.createdAt,
      clientIds: clients
        .filter((c) => c.name === machineClientName(i.id))
        .map((c) => c.clientId),
      outcome: 'pending',
    }));

    const orphanClients: OrphanMachineClient[] = [];
    for (const client of clients) {
      if (provisioningNames.has(client.name)) continue;
      const integration = await this.integrationClients.findByClientId(
        client.clientId,
      );
      if (integration?.isActive()) continue;
      orphanClients.push({ ...client, outcome: 'pending' });
    }

    if (apply) {
      for (const item of staleProvisioning) {
        item.outcome = await this.failStale(item);
      }
      for (const orphan of orphanClients) {
        orphan.outcome = await this.deleteClient(orphan.clientId);
      }
    }

    return { apply, staleProvisioning, orphanClients };
  }

  private async failStale(item: StaleProvisioning): Promise<ReconcileOutcome> {
    let failed: boolean;
    try {
      failed = await failProvisioning(
        {
          organizations: this.organizations,
          integrationClients: this.integrationClients,
          transactions: this.transactions,
          clock: this.clock,
        },
        { organizationId: item.organizationId, id: item.integrationId },
      );
    } catch (error) {
      this.logger.error(
        `Integração ${item.integrationId} não foi marcada FAILED.`,
        error,
      );
      return 'error';
    }
    // Ativada antes da trava: o client listado é o dela, e fica.
    if (!failed) return 'skipped';

    let outcome: ReconcileOutcome = 'done';
    for (const clientId of item.clientIds) {
      if ((await this.deleteClient(clientId)) === 'error') outcome = 'error';
    }
    return outcome;
  }

  private async deleteClient(clientId: string): Promise<ReconcileOutcome> {
    try {
      await this.machineClients.delete(clientId);
      return 'done';
    } catch (error) {
      this.logger.error(`App client ${clientId} não foi apagado.`, error);
      return 'error';
    }
  }
}
