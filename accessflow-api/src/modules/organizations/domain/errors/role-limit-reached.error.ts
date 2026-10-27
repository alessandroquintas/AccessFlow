import { DomainError } from '@/shared/domain/errors/domain.error';

export class RoleLimitReachedError extends DomainError {
  readonly code = 'ROLE_LIMIT_REACHED';

  constructor() {
    super('A organização atingiu o limite de papéis personalizados.');
  }
}
