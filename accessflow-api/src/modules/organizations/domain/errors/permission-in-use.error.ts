import { DomainError } from '@/shared/domain/errors/domain.error';

export class PermissionInUseError extends DomainError {
  readonly code = 'PERMISSION_IN_USE';

  constructor() {
    super('A permissão ainda é concedida por algum papel.');
  }
}
