import { ClockPort } from '@/shared/application/ports/clock.port';
import { InvitationNotFoundError } from '../../domain/errors/invitation-not-found.error';
import { InvitationRepository } from '../../domain/repositories/invitation.repository';
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

    // Manter, reativar ou criar o membership é decidido dentro da transação
    // do repositório, com o estado do banco já travado.
    invitation.accept(now);
    const membership = await this.invitations.accept(invitation, {
      userId: user.id,
      now,
    });

    return { organization, membership };
  }
}
