import { DomainError } from '@/shared/domain/errors/domain.error';

/**
 * O provedor de identidade não criou o app client, ou a integração não pôde
 * ser ativada depois dele. A mensagem não traz o motivo, que vai para o log.
 */
export class IntegrationProvisioningFailedError extends DomainError {
  readonly code = 'INTEGRATION_PROVISIONING_FAILED';

  constructor() {
    super('Não foi possível criar a integração agora. Tente de novo.');
  }
}
