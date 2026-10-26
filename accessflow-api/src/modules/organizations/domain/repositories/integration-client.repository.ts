import { IntegrationClient } from '../entities/integration-client.entity';

export abstract class IntegrationClientRepository {
  abstract findByClientId(clientId: string): Promise<IntegrationClient | null>;
}
