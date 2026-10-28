import { DomainError } from '@/shared/domain/errors/domain.error';

export class PermissionKeyTakenError extends DomainError {
  readonly code = 'PERMISSION_KEY_TAKEN';

  constructor() {
    super('Já existe uma permissão com essa chave nesta organização.');
  }
}
