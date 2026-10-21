import { DomainError } from '@/shared/domain/errors/domain.error';

export class SlugAlreadyTakenError extends DomainError {
  readonly code = 'SLUG_ALREADY_TAKEN';

  constructor() {
    super('Este identificador de organização já está em uso.');
  }
}
