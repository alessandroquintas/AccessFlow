import { DomainError } from '@/shared/domain/errors/domain.error';

export class SystemRoleImmutableError extends DomainError {
  readonly code = 'SYSTEM_ROLE_IMMUTABLE';
}
