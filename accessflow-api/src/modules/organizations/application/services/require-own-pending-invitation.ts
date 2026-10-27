import { isUuid } from '@/shared/domain/uuid';
import { Invitation } from '../../domain/entities/invitation.entity';
import { InvitationNotFoundError } from '../../domain/errors/invitation-not-found.error';
import { InvitationRepository } from '../../domain/repositories/invitation.repository';
import { ActiveUser } from '../ports/user-directory.port';

/**
 * Convite pendente e no prazo endereçado ao e-mail do usuário. Inexistente,
 * de outro e-mail, expirado ou já respondido: InvitationNotFoundError, para
 * não revelar convites de outras pessoas.
 */
export async function requireOwnPendingInvitation(
  invitations: InvitationRepository,
  user: ActiveUser,
  invitationId: string,
  now: Date,
): Promise<Invitation> {
  const id = invitationId.toLowerCase();
  if (!isUuid(id)) throw new InvitationNotFoundError();

  const invitation = await invitations.findById(id);
  if (
    !invitation ||
    invitation.email.toLowerCase() !== user.email.toLowerCase() ||
    !invitation.isPendingAt(now)
  ) {
    throw new InvitationNotFoundError();
  }

  return invitation;
}
