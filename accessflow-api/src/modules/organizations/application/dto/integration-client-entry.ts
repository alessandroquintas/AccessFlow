import { IntegrationClient } from '../../domain/entities/integration-client.entity';

export interface IntegrationCreator {
  userId: string;
  name: string;
}

/** Integração vista pelo painel da organização. */
export interface IntegrationClientEntry {
  integration: IntegrationClient;
  /** Nulo nas anteriores ao painel (ex.: a demo do Terraform). */
  createdBy: IntegrationCreator | null;
}

/** O client_secret só existe nesta resposta: não é gravado em lugar nenhum. */
export interface CreatedIntegrationClient {
  integration: IntegrationClientEntry;
  clientSecret: string;
}
