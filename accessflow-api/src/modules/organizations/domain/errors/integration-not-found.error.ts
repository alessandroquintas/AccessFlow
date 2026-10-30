import { DomainError } from '@/shared/domain/errors/domain.error';

export class IntegrationNotFoundError extends DomainError {
  readonly code = 'INTEGRATION_NOT_FOUND';

  constructor() {
    super('Integração não encontrada nesta organização.');
  }
}
