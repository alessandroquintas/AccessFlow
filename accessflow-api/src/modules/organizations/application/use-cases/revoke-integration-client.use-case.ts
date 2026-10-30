import { ClockPort } from '@/shared/application/ports/clock.port';
import { LoggerPort } from '@/shared/application/ports/logger.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import {
  AuditAction,
  AuditEvent,
  userActor,
} from '../../domain/entities/audit-event.entity';
import { IntegrationNotFoundError } from '../../domain/errors/integration-not-found.error';
import { AuditLog } from '../../domain/repositories/audit-log.repository';
import { IntegrationClientRepository } from '../../domain/repositories/integration-client.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { MachineClientProvisioner } from '../ports/machine-client-provisioner.port';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';

export interface RevokeIntegrationClientInput {
  cognitoSub: string;
  organizationId: string;
  integrationId: string;
}

/**
 * Revoga sob a trava (REVOKED e integration.revoked) e, depois do commit,
 * apaga o app client no Cognito. A revogação vale no commit: a partir dele
 * os tokens que ainda não expiraram já não autorizam nada, porque só ACTIVE
 * autoriza. Se apagar falhar, fica no log e a reconciliação apaga depois.
 * Já revogada: idempotente, sem evento e sem nova chamada ao Cognito.
 */
export class RevokeIntegrationClientUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly integrationClients: IntegrationClientRepository,
    private readonly machineClients: MachineClientProvisioner,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
    private readonly audit: AuditLog,
    private readonly transactions: TransactionManager,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(input: RevokeIntegrationClientInput): Promise<void> {
    const actorId = await this.users.getActiveUserId(input.cognitoSub);
    const organizationId = input.organizationId.toLowerCase();

    const revoked = await this.transactions.run(async () => {
      await this.organizations.lock(organizationId);
      await this.access.requirePermission(
        organizationId,
        actorId,
        OrganizationPermission.INTEGRATIONS_MANAGE,
      );

      // De outra organização responde como inexistente.
      const integration = await this.integrationClients.findById(
        organizationId,
        input.integrationId.toLowerCase(),
      );
      if (!integration) throw new IntegrationNotFoundError();

      const now = this.clock.now();
      if (!integration.revoke(actorId, now)) return null;

      await this.integrationClients.save(integration);
      await this.audit.record(
        AuditEvent.create(
          {
            organizationId,
            actor: userActor(actorId),
            action: AuditAction.INTEGRATION_REVOKED,
            targetId: integration.id,
            details: { clientId: integration.clientId! },
          },
          now,
        ),
      );
      return integration;
    });
    if (!revoked) return;

    try {
      await this.machineClients.delete(revoked.clientId!);
    } catch (error) {
      this.logger.error(
        `Integração ${revoked.id} revogada, mas o app client ${revoked.clientId} continua no Cognito; a reconciliação o apaga.`,
        error,
      );
    }
  }
}
