import { DomainError } from '@/shared/domain/errors/domain.error';

export class UserInactiveError extends DomainError {
  readonly code = 'USER_INACTIVE';
  constructor() {
    super('Usuário inativo');
  }
}
