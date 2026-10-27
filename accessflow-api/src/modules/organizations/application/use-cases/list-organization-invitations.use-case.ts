import {
  InvitationCursor,
  InvitationRepository,
} from '../../domain/repositories/invitation.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { OrganizationInvitationsPage } from '../dto/organization-invitation';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { attachInviters } from '../services/attach-inviters';
import { OrganizationAccessService } from '../services/organization-access.service';

export interface ListOrganizationInvitationsInput {
  cognitoSub: string;
  organizationId: string;
  first: number;
  after?: InvitationCursor;
}

export class ListOrganizationInvitationsUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
  ) {}

  /** Pendentes da organização, expirados incluídos, mais recentes primeiro. */
  async execute(
    input: ListOrganizationInvitationsInput,
  ): Promise<OrganizationInvitationsPage> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);
    const organizationId = input.organizationId.toLowerCase();

    await this.access.requirePermission(
      organizationId,
      userId,
      OrganizationPermission.MEMBERS_INVITE,
    );

    const page = await this.invitations.listPendingByOrganization(
      organizationId,
      { first: input.first, after: input.after },
    );

    return {
      items: await attachInviters(this.users, page.items),
      hasNextPage: page.hasNextPage,
    };
  }
}
