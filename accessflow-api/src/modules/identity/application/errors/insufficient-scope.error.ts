import { DomainError } from '@/shared/domain/errors/domain.error';

export class InsufficientScopeError extends DomainError {
  readonly code = 'INSUFFICIENT_SCOPE';

  constructor() {
    super('O token não tem permissão para esta operação.');
  }
}
