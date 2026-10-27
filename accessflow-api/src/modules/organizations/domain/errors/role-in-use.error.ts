import { DomainError } from '@/shared/domain/errors/domain.error';

export class RoleInUseError extends DomainError {
  readonly code = 'ROLE_IN_USE';

  constructor() {
    super('O papel ainda é usado por membros ativos ou convites pendentes.');
  }
}
