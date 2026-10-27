import { ClockPort } from '@/shared/application/ports/clock.port';
import { Invitation } from '../../domain/entities/invitation.entity';
import { Membership } from '../../domain/entities/membership.entity';
import { InvitationNotFoundError } from '../../domain/errors/invitation-not-found.error';
import { InvitationRepository } from '../../domain/repositories/invitation.repository';
import { MembershipRepository } from '../../domain/repositories/membership.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { OrganizationWithMembership } from '../dto/organization-with-membership';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { requireOwnPendingInvitation } from '../services/require-own-pending-invitation';

export interface AcceptInvitationInput {
  cognitoSub: string;
  invitationId: string;
}

export class AcceptInvitationUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly organizations: OrganizationRepository,
    private readonly memberships: MembershipRepository,
    private readonly users: UserDirectoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    input: AcceptInvitationInput,
  ): Promise<OrganizationWithMembership> {
    const user = await this.users.getActiveUser(input.cognitoSub);
    const now = this.clock.now();

    const invitation = await requireOwnPendingInvitation(
      this.invitations,
      user,
      input.invitationId,
      now,
    );

    const organization = await this.organizations.findById(
      invitation.organizationId,
    );
    if (!organization?.isActive()) throw new InvitationNotFoundError();

    const existing = await this.memberships.findByOrganizationAndUser(
      invitation.organizationId,
      user.id,
    );
    const membership = this.membershipFor(existing, invitation, user.id, now);

    invitation.accept(now);
    await this.invitations.accept(invitation, membership);

    return { organization, membership };
  }

  /** Nunca cria um segundo membership para o mesmo (organização, usuário). */
  private membershipFor(
    existing: Membership | null,
    invitation: Invitation,
    userId: string,
    now: Date,
  ): Membership {
    // Já é membro: o convite é consumido e o papel atual não muda.
    if (existing?.isActive()) return existing;

    if (existing) {
      existing.reactivate(invitation.role, now);
      return existing;
    }

    return Membership.create(
      {
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
      },
      now,
    );
  }
}
