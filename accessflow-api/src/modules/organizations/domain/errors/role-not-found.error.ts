import { DomainError } from '@/shared/domain/errors/domain.error';

export class RoleNotFoundError extends DomainError {
  readonly code = 'ROLE_NOT_FOUND';

  constructor() {
    super('Papel não encontrado nesta organização.');
  }
}
