import { IntegrationClient } from '@/modules/organizations/domain/entities/integration-client.entity';
import { IntegrationClientRepository } from '@/modules/organizations/domain/repositories/integration-client.repository';

export class InMemoryIntegrationClientRepository extends IntegrationClientRepository {
  items: IntegrationClient[] = [];

  async findByClientId(clientId: string): Promise<IntegrationClient | null> {
    return this.items.find((c) => c.clientId === clientId) ?? null;
  }
}
