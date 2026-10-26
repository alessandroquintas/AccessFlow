import { DomainError } from '@/shared/domain/errors/domain.error';

export class CannotRemoveSelfError extends DomainError {
  readonly code = 'CANNOT_REMOVE_SELF';

  constructor() {
    super('Não é possível remover a si mesmo da organização.');
  }
}
