import { DomainError } from '@/shared/domain/errors/domain.error';

export class RoleNameTakenError extends DomainError {
  readonly code = 'ROLE_NAME_TAKEN';

  constructor() {
    super('Já existe um papel com esse nome nesta organização.');
  }
}
