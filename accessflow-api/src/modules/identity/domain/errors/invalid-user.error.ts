import { DomainError } from '@/shared/domain/errors/domain.error';

export class InvalidUserError extends DomainError {
  readonly code = 'INVALID_USER';
}
