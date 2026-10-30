import { ClockPort } from '@/shared/application/ports/clock.port';
import { LoggerPort } from '@/shared/application/ports/logger.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import {
  AuditAction,
  AuditEvent,
  userActor,
} from '../../domain/entities/audit-event.entity';
import { IntegrationClient } from '../../domain/entities/integration-client.entity';
import { IntegrationLimitReachedError } from '../../domain/errors/integration-limit-reached.error';
import { AuditLog } from '../../domain/repositories/audit-log.repository';
import { IntegrationClientRepository } from '../../domain/repositories/integration-client.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { ensureCanGrantScopes } from '../../policies/privilege-escalation';
import { CreatedIntegrationClient } from '../dto/integration-client-entry';
import { IntegrationProvisioningFailedError } from '../errors/integration-provisioning-failed.error';
import {
  MachineClientProvisioner,
  machineClientName,
  ProvisionedMachineClient,
} from '../ports/machine-client-provisioner.port';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { failProvisioning } from '../services/fail-provisioning';
import { OrganizationAccessService } from '../services/organization-access.service';

export interface CreateIntegrationClientInput {
  cognitoSub: string;
  organizationId: string;
  name: string;
  scopes: string[];
}

/**
 * Cria a integração em três passos, sem segurar a trava da organização
 * durante a chamada ao Cognito:
 *
 * 1. transação: trava, valida, confere o limite e grava em PROVISIONING;
 * 2. fora da transação: cria o app client no Cognito;
 * 3. transação: trava, ativa com o client_id e audita integration.created.
 *
 * Falha no passo 2: a linha vira FAILED. Falha no passo 3: o app client é
 * apagado (compensação) e a linha vira FAILED. Nos dois casos quem chamou
 * recebe IntegrationProvisioningFailedError e o motivo vai para o log. O que
 * a compensação não conseguir desfazer fica para a reconciliação.
 *
 * O client_secret só existe no retorno: não vai para o banco, o log, a
 * auditoria nem mensagem de erro.
 */
export class CreateIntegrationClientUseCase {
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

  async execute(
    input: CreateIntegrationClientInput,
  ): Promise<CreatedIntegrationClient> {
    const actorId = await this.users.getActiveUserId(input.cognitoSub);
    const organizationId = input.organizationId.toLowerCase();
    // Antes de tudo: depois da ativação, nada mais pode falhar, ou o
    // segredo se perderia com a integração já ativa.
    const [creator] = await this.users.getProfilesByIds([actorId]);

    const pending = await this.reserve(organizationId, actorId, input);

    let provisioned: ProvisionedMachineClient;
    try {
      provisioned = await this.machineClients.create({
        name: machineClientName(pending.id),
        scopes: pending.scopes,
      });
    } catch (error) {
      this.logger.error(
        `Cognito não criou o app client da integração ${pending.id}.`,
        error,
      );
      await this.markFailed(pending);
      throw new IntegrationProvisioningFailedError();
    }

    let active: IntegrationClient;
    try {
      active = await this.activate(pending, actorId, provisioned.clientId);
    } catch (error) {
      this.logger.error(
        `Integração ${pending.id} não foi ativada; apagando o app client ${provisioned.clientId}.`,
        error,
      );
      await this.compensate(pending, provisioned.clientId);
      throw new IntegrationProvisioningFailedError();
    }

    return {
      integration: {
        integration: active,
        createdBy: creator ? { userId: creator.id, name: creator.name } : null,
      },
      clientSecret: provisioned.clientSecret,
    };
  }

  /** Passo 1. */
  private reserve(
    organizationId: string,
    actorId: string,
    input: CreateIntegrationClientInput,
  ): Promise<IntegrationClient> {
    return this.transactions.run(async () => {
      // Trava antes de checar: a permissão, o papel e o limite valem até o
      // commit.
      await this.organizations.lock(organizationId);
      const { role } = await this.access.requirePermission(
        organizationId,
        actorId,
        OrganizationPermission.INTEGRATIONS_MANAGE,
      );

      const integration = IntegrationClient.create(
        {
          organizationId,
          name: input.name,
          scopes: input.scopes,
          createdByUserId: actorId,
        },
        this.clock.now(),
      );
      ensureCanGrantScopes(role, integration.scopes);

      const live =
        await this.integrationClients.countLiveByOrganization(organizationId);
      if (live >= IntegrationClient.MAX_LIVE_PER_ORGANIZATION) {
        throw new IntegrationLimitReachedError();
      }

      await this.integrationClients.create(integration);
      return integration;
    });
  }

  /**
   * Passo 3. Relê a linha sob a trava: se a reconciliação a marcou FAILED
   * nesse meio-tempo, activate lança e a criação é compensada.
   */
  private activate(
    pending: IntegrationClient,
    actorId: string,
    clientId: string,
  ): Promise<IntegrationClient> {
    return this.transactions.run(async () => {
      await this.organizations.lock(pending.organizationId);
      const integration = await this.integrationClients.findById(
        pending.organizationId,
        pending.id,
      );
      if (!integration) throw new Error('Integração em criação sumiu.');

      const now = this.clock.now();
      integration.activate(clientId, now);
      await this.integrationClients.save(integration);
      await this.audit.record(
        AuditEvent.create(
          {
            organizationId: integration.organizationId,
            actor: userActor(actorId),
            action: AuditAction.INTEGRATION_CREATED,
            targetId: integration.id,
            details: {
              name: integration.name,
              scopes: [...integration.scopes],
              clientId,
            },
          },
          now,
        ),
      );
      return integration;
    });
  }

  /** Apaga o app client criado e deixa a linha FAILED, mesmo se apagar falhar. */
  private async compensate(
    pending: IntegrationClient,
    clientId: string,
  ): Promise<void> {
    try {
      await this.machineClients.delete(clientId);
    } catch (error) {
      this.logger.error(
        `Compensação falhou: o app client ${clientId} da integração ${pending.id} continua no Cognito; a reconciliação o apaga.`,
        error,
      );
    }
    await this.markFailed(pending);
  }

  /**
   * Sem conseguir marcar, a linha fica em PROVISIONING (ocupando vaga) até a
   * reconciliação, que trata as presas há mais de 15 minutos.
   */
  private async markFailed(pending: IntegrationClient): Promise<void> {
    try {
      await failProvisioning(
        {
          organizations: this.organizations,
          integrationClients: this.integrationClients,
          transactions: this.transactions,
          clock: this.clock,
        },
        pending,
      );
    } catch (error) {
      this.logger.error(
        `Integração ${pending.id} não foi marcada FAILED; fica em PROVISIONING até a reconciliação.`,
        error,
      );
    }
  }
}
