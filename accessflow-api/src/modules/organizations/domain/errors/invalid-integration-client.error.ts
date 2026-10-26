import { DomainError } from '@/shared/domain/errors/domain.error';

export class InvalidIntegrationClientError extends DomainError {
  readonly code = 'INVALID_INTEGRATION_CLIENT';
}
