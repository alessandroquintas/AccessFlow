import { DomainError } from '@/shared/domain/errors/domain.error';

export class UserAlreadyExistsError extends DomainError {
  readonly code = 'USER_ALREADY_EXISTS';

  constructor() {
    super('Perfil de usuário já existe.');
  }
}
