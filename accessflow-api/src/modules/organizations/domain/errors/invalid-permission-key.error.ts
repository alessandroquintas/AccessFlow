import { DomainError } from '@/shared/domain/errors/domain.error';

export class InvalidPermissionKeyError extends DomainError {
  readonly code = 'INVALID_PERMISSION_KEY';
}
