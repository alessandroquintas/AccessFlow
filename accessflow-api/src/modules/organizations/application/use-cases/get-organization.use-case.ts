import { OrganizationWithMembership } from '../dto/organization-with-membership';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';

export class GetOrganizationUseCase {
  constructor(
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
  ) {}

  async execute(input: {
    cognitoSub: string;
    organizationId: string;
  }): Promise<OrganizationWithMembership> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);
    return this.access.requireMember(input.organizationId, userId);
  }
}
