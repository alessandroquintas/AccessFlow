import { DomainError } from '@/shared/domain/errors/domain.error';

export class InvitationNotFoundError extends DomainError {
  readonly code = 'INVITATION_NOT_FOUND';

  constructor() {
    super('Convite não encontrado.');
  }
}
