import { DomainError } from '@/shared/domain/errors/domain.error';

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';
  constructor() {
    super('Perfil de usuario não encontrado');
  }
}
