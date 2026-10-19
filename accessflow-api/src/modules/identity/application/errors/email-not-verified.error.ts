import { DomainError } from '@/shared/domain/errors/domain.error';

export class EmailNotVerifiedError extends DomainError {
  readonly code = 'EMAIL_NOT_VERIFIED';

  constructor() {
    super('O e-mail da conta ainda não foi verificado.');
  }
}
