import {
  MembershipCursor,
  MembershipRepository,
} from '../../domain/repositories/membership.repository';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { OrganizationMembersPage } from '../dto/organization-member';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';
import { rolesById } from '../services/roles-by-id';

export interface ListOrganizationMembersInput {
  cognitoSub: string;
  organizationId: string;
  first: number;
  after?: MembershipCursor;
}

export class ListOrganizationMembersUseCase {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly roles: RoleRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
  ) {}

  async execute(
    input: ListOrganizationMembersInput,
  ): Promise<OrganizationMembersPage> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);

    await this.access.requirePermission(
      input.organizationId,
      userId,
      OrganizationPermission.MEMBERS_READ,
    );

    const page = await this.memberships.listActiveByOrganization(
      input.organizationId,
      { first: input.first, after: input.after },
    );

    const [profiles, roleById] = await Promise.all([
      this.users.getProfilesByIds(
        page.items.map((membership) => membership.userId),
      ),
      rolesById(
        this.roles,
        page.items.map((membership) => membership.roleId),
      ),
    ]);
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));

    return {
      items: page.items.flatMap((membership) => {
        const profile = byId.get(membership.userId);
        const role = roleById.get(membership.roleId);
        return profile && role ? [{ membership, profile, role }] : [];
      }),
      hasNextPage: page.hasNextPage,
    };
  }
}
