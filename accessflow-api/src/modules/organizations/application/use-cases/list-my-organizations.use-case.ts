import { MembershipRepository } from '../../domain/repositories/membership.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { OrganizationWithMembership } from '../dto/organization-with-membership';
import { UserDirectoryPort } from '../ports/user-directory.port';

export class ListMyOrganizationsUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly memberships: MembershipRepository,
    private readonly users: UserDirectoryPort,
  ) {}

  async execute(cognitoSub: string): Promise<OrganizationWithMembership[]> {
    const userId = await this.users.getActiveUserId(cognitoSub);

    const memberships = await this.memberships.listActiveByUser(userId);
    if (memberships.length === 0) {
      return [];
    }

    const organizations = await this.organizations.findByIds(
      memberships.map((membership) => membership.organizationId),
    );
    const byId = new Map(
      organizations.map((organization) => [organization.id, organization]),
    );

    return memberships.flatMap((membership) => {
      const organization = byId.get(membership.organizationId);
      return organization?.isActive() ? [{ organization, membership }] : [];
    });
  }
}
