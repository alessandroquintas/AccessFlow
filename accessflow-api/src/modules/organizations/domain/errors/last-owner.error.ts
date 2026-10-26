import { DomainError } from '@/shared/domain/errors/domain.error';

export class LastOwnerError extends DomainError {
  readonly code = 'LAST_OWNER';

  constructor() {
    super('A organização precisa ter pelo menos um OWNER ativo.');
  }
}
