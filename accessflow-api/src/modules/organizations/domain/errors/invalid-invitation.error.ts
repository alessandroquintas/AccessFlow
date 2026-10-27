import { DomainError } from '@/shared/domain/errors/domain.error';

export class InvalidInvitationError extends DomainError {
  readonly code = 'INVALID_INVITATION';
}
