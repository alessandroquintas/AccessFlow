import { DomainError } from '@/shared/domain/errors/domain.error';

export class InvalidCursorError extends DomainError {
  readonly code = 'INVALID_CURSOR';

  constructor() {
    super('Cursor de paginação inválido.');
  }
}
