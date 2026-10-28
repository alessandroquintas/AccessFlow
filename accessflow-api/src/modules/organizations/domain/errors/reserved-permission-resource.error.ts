import { DomainError } from '@/shared/domain/errors/domain.error';

export class ReservedPermissionResourceError extends DomainError {
  readonly code = 'RESERVED_PERMISSION_RESOURCE';
}
