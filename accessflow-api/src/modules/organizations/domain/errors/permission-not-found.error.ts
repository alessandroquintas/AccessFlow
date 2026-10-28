import { DomainError } from '@/shared/domain/errors/domain.error';

export class PermissionNotFoundError extends DomainError {
  readonly code = 'PERMISSION_NOT_FOUND';

  constructor() {
    super('Permissão não encontrada nesta organização.');
  }
}
