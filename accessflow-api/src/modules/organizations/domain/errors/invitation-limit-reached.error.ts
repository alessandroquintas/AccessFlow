import { DomainError } from '@/shared/domain/errors/domain.error';

export class InvitationLimitReachedError extends DomainError {
  readonly code = 'INVITATION_LIMIT_REACHED';

  constructor() {
    super('A organização atingiu o limite de convites pendentes.');
  }
}
