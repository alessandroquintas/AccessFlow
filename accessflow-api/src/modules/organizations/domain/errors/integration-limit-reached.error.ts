import { DomainError } from '@/shared/domain/errors/domain.error';

export class IntegrationLimitReachedError extends DomainError {
  readonly code = 'INTEGRATION_LIMIT_REACHED';

  constructor() {
    super('A organização atingiu o limite de integrações não revogadas.');
  }
}
