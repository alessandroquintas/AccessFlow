import { ClockPort } from '@/shared/application/ports/clock.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { IntegrationClientStatus } from '../../domain/entities/integration-client.entity';
import { IntegrationClientRepository } from '../../domain/repositories/integration-client.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';

/**
 * Marca como FAILED, sob a trava da organização, uma integração que ainda
 * esteja em PROVISIONING. Se ela já saiu de PROVISIONING (foi ativada, ou
 * outro caminho a marcou), nada muda e devolve false: quem chamou não deve
 * apagar o app client dela.
 */
export async function failProvisioning(
  deps: {
    organizations: OrganizationRepository;
    integrationClients: IntegrationClientRepository;
    transactions: TransactionManager;
    clock: ClockPort;
  },
  target: { organizationId: string; id: string },
): Promise<boolean> {
  return deps.transactions.run(async () => {
    await deps.organizations.lock(target.organizationId);
    const integration = await deps.integrationClients.findById(
      target.organizationId,
      target.id,
    );
    if (integration?.status !== IntegrationClientStatus.PROVISIONING) {
      return false;
    }

    integration.fail(deps.clock.now());
    await deps.integrationClients.save(integration);
    return true;
  });
}
