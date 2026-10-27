import { DomainError } from '@/shared/domain/errors/domain.error';

export class InvalidPermissionError extends DomainError {
  readonly code = 'INVALID_PERMISSION';

  constructor(key: string) {
    super(`Permissão fora do catálogo: "${key}".`);
  }
}
