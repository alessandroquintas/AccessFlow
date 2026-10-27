import { DomainError } from '@/shared/domain/errors/domain.error';

export class InvalidRoleError extends DomainError {
  readonly code = 'INVALID_ROLE';
}
