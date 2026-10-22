import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { OrganizationWithMembership } from '../dto/organization-with-membership';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';

export interface UpdateOrganizationInput {
  cognitoSub: string;
  organizationId: string;
  name: string;
}

export class UpdateOrganizationUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
  ) {}

  async execute(
    input: UpdateOrganizationInput,
  ): Promise<OrganizationWithMembership> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);

    const context = await this.access.requirePermission(
      input.organizationId,
      userId,
      OrganizationPermission.ORGANIZATIONS_UPDATE,
    );

    context.organization.rename(input.name);
    await this.organizations.save(context.organization);

    return context;
  }
}
