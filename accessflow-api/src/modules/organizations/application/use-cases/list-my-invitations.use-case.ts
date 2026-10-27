import { ClockPort } from '@/shared/application/ports/clock.port';
import { InvitationRepository } from '../../domain/repositories/invitation.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { MyInvitation } from '../dto/my-invitation';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { describeInvitations } from '../services/describe-invitations';

export class ListMyInvitationsUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly organizations: OrganizationRepository,
    private readonly roles: RoleRepository,
    private readonly users: UserDirectoryPort,
    private readonly clock: ClockPort,
  ) {}

  /**
   * Convites pendentes e no prazo para o e-mail do perfil, mais recentes
   * primeiro. Convites de organizações inativas ficam de fora.
   */
  async execute(input: { cognitoSub: string }): Promise<MyInvitation[]> {
    const user = await this.users.getActiveUser(input.cognitoSub);

    const pending = await this.invitations.listPendingByEmail(
      user.email,
      this.clock.now(),
    );

    const organizations = await this.organizations.findByIds([
      ...new Set(pending.map((invitation) => invitation.organizationId)),
    ]);
    const activeById = new Map(
      organizations
        .filter((organization) => organization.isActive())
        .map((organization) => [organization.id, organization]),
    );

    const visible = await describeInvitations(
      this.users,
      this.roles,
      pending.filter((invitation) => activeById.has(invitation.organizationId)),
    );

    return visible.map(({ invitation, invitedBy, role }) => ({
      invitation,
      organization: activeById.get(invitation.organizationId)!,
      invitedByName: invitedBy.name,
      role,
    }));
  }
}
