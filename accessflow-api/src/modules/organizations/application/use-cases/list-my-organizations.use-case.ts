import { MembershipRepository } from '../../domain/repositories/membership.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { OrganizationWithMembership } from '../dto/organization-with-membership';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { rolesById } from '../services/roles-by-id';

export class ListMyOrganizationsUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly memberships: MembershipRepository,
    private readonly roles: RoleRepository,
    private readonly users: UserDirectoryPort,
  ) {}

  async execute(cognitoSub: string): Promise<OrganizationWithMembership[]> {
    const userId = await this.users.getActiveUserId(cognitoSub);

    const memberships = await this.memberships.listActiveByUser(userId);
    if (memberships.length === 0) {
      return [];
    }

    const [organizations, roleById] = await Promise.all([
      this.organizations.findByIds(
        memberships.map((membership) => membership.organizationId),
      ),
      rolesById(
        this.roles,
        memberships.map((membership) => membership.roleId),
      ),
    ]);
    const byId = new Map(
      organizations.map((organization) => [organization.id, organization]),
    );

    return memberships.flatMap((membership) => {
      const organization = byId.get(membership.organizationId);
      const role = roleById.get(membership.roleId);
      return organization?.isActive() && role
        ? [{ organization, membership, role }]
        : [];
    });
  }
}
