import {
  MembershipCursor,
  MembershipRepository,
} from '../../domain/repositories/membership.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { OrganizationMembersPage } from '../dto/organization-member';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';

export interface ListOrganizationMembersInput {
  cognitoSub: string;
  organizationId: string;
  first: number;
  after?: MembershipCursor;
}

export class ListOrganizationMembersUseCase {
  constructor(
    private readonly memberships: MembershipRepository,
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

    const profiles = await this.users.getProfilesByIds(
      page.items.map((membership) => membership.userId),
    );
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));

    return {
      items: page.items.flatMap((membership) => {
        const profile = byId.get(membership.userId);
        return profile ? [{ membership, profile }] : [];
      }),
      hasNextPage: page.hasNextPage,
    };
  }
}
