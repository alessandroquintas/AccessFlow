import { ClockPort } from '@/shared/application/ports/clock.port';
import { InvitationRepository } from '../../domain/repositories/invitation.repository';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { requireOwnPendingInvitation } from '../services/require-own-pending-invitation';

export interface DeclineInvitationInput {
  cognitoSub: string;
  invitationId: string;
}

export class DeclineInvitationUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserDirectoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: DeclineInvitationInput): Promise<void> {
    const user = await this.users.getActiveUser(input.cognitoSub);
    const now = this.clock.now();

    const invitation = await requireOwnPendingInvitation(
      this.invitations,
      user,
      input.invitationId,
      now,
    );

    invitation.decline(now);
    await this.invitations.respond(invitation);
  }
}
