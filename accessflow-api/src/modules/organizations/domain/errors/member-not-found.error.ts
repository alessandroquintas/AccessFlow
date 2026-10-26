import { DomainError } from '@/shared/domain/errors/domain.error';

export class MemberNotFoundError extends DomainError {
  readonly code = 'MEMBER_NOT_FOUND';

  constructor() {
    super('Membro não encontrado nesta organização.');
  }
}
