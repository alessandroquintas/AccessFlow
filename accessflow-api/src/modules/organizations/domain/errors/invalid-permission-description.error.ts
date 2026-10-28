import { DomainError } from '@/shared/domain/errors/domain.error';

export class InvalidPermissionDescriptionError extends DomainError {
  readonly code = 'INVALID_PERMISSION_DESCRIPTION';
}
