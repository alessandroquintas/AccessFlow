import { DomainError } from '@/shared/domain/errors/domain.error';

export class InvalidAccessTokenError extends DomainError {
  readonly code = 'INVALID_ACCESS_TOKEN';

  constructor() {
    super('Token de acesso inválido ou expirado.');
  }
}
