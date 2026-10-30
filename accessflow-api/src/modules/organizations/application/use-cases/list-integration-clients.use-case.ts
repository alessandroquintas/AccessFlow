import { IntegrationClientRepository } from '../../domain/repositories/integration-client.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { IntegrationClientEntry } from '../dto/integration-client-entry';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { describeIntegrations } from '../services/describe-integrations';
import { OrganizationAccessService } from '../services/organization-access.service';

export interface ListIntegrationClientsInput {
  cognitoSub: string;
  organizationId: string;
}

export class ListIntegrationClientsUseCase {
  constructor(
    private readonly integrationClients: IntegrationClientRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
  ) {}

  /** Todas, em qualquer status, da mais nova à mais antiga. */
  async execute(
    input: ListIntegrationClientsInput,
  ): Promise<IntegrationClientEntry[]> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);
    const organizationId = input.organizationId.toLowerCase();

    await this.access.requirePermission(
      organizationId,
      userId,
      OrganizationPermission.INTEGRATIONS_READ,
    );

    return describeIntegrations(
      this.users,
      await this.integrationClients.listByOrganization(organizationId),
    );
  }
}
