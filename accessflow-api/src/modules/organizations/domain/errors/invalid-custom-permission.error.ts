import { DomainError } from '@/shared/domain/errors/domain.error';

export class InvalidCustomPermissionError extends DomainError {
  readonly code = 'INVALID_CUSTOM_PERMISSION';
}
