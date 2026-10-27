import { DomainError } from '@/shared/domain/errors/domain.error';

export class AlreadyMemberError extends DomainError {
  readonly code = 'ALREADY_MEMBER';

  constructor() {
    super('Este e-mail já pertence a um membro da organização.');
  }
}
