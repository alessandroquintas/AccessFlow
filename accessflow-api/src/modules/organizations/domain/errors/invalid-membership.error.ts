import { DomainError } from '@/shared/domain/errors/domain.error';

export class InvalidMembershipError extends DomainError {
  readonly code = 'INVALID_MEMBERSHIP';
}
