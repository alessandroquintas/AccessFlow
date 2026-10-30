import {
  IntegrationClient,
  IntegrationClientStatus,
} from '@/modules/organizations/domain/entities/integration-client.entity';
import { IntegrationClientRepository } from '@/modules/organizations/domain/repositories/integration-client.repository';

/** Guarda cópias, como a tabela: mudar a entidade não muda o gravado sem save. */
function copy(client: IntegrationClient): IntegrationClient {
  return IntegrationClient.restore({
    id: client.id,
    organizationId: client.organizationId,
    clientId: client.clientId,
    name: client.name,
    scopes: client.scopes,
    status: client.status,
    createdByUserId: client.createdByUserId,
    revokedAt: client.revokedAt,
    revokedByUserId: client.revokedByUserId,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  });
}

export class InMemoryIntegrationClientRepository extends IntegrationClientRepository {
  items: IntegrationClient[] = [];

  async findByClientId(clientId: string): Promise<IntegrationClient | null> {
    const found = this.items.find((c) => c.clientId === clientId);
    return found ? copy(found) : null;
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<IntegrationClient | null> {
    const found = this.items.find(
      (c) => c.id === id && c.organizationId === organizationId,
    );
    return found ? copy(found) : null;
  }

  async listByOrganization(
    organizationId: string,
  ): Promise<IntegrationClient[]> {
    return this.items
      .filter((c) => c.organizationId === organizationId)
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          (a.id < b.id ? 1 : -1),
      )
      .map(copy);
  }

  async countLiveByOrganization(organizationId: string): Promise<number> {
    return this.items.filter(
      (c) => c.organizationId === organizationId && c.isLive(),
    ).length;
  }

  async listProvisioning(): Promise<IntegrationClient[]> {
    return this.items
      .filter((c) => c.status === IntegrationClientStatus.PROVISIONING)
      .sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          (a.id < b.id ? -1 : 1),
      )
      .map(copy);
  }

  async create(client: IntegrationClient): Promise<void> {
    if (
      client.clientId &&
      this.items.some((c) => c.clientId === client.clientId)
    ) {
      throw new Error('client_id repetido');
    }
    this.items.push(copy(client));
  }

  async save(client: IntegrationClient): Promise<void> {
    const index = this.items.findIndex((c) => c.id === client.id);
    if (index < 0) throw new Error('integração inexistente');
    this.items[index] = copy(client);
  }
}
