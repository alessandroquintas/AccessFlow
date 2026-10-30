import { DomainError } from '@/shared/domain/errors/domain.error';

/** Revogar uma integração que não chegou a ficar ativa (em criação ou com falha). */
export class IntegrationNotActiveError extends DomainError {
  readonly code = 'INTEGRATION_NOT_ACTIVE';

  constructor() {
    super('A integração não está ativa.');
  }
}
