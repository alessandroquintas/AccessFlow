import { Injectable } from '@nestjs/common';
import { IntegrationClientStatus as PrismaIntegrationClientStatus } from '@prisma/client';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { isUuid } from '@/shared/domain/uuid';
import { IntegrationClient } from '@/modules/organizations/domain/entities/integration-client.entity';
import { IntegrationClientRepository } from '@/modules/organizations/domain/repositories/integration-client.repository';
import { PrismaIntegrationClientMapper } from './mappers/prisma-integration-client.mapper';

@Injectable()
export class PrismaIntegrationClientRepository extends IntegrationClientRepository {
  constructor(private readonly clients: PrismaClientProvider) {
    super();
  }

  async findByClientId(clientId: string): Promise<IntegrationClient | null> {
    const record = await this.clients.current().integrationClient.findUnique({
      where: {
        clientId,
      },
    });
    return record ? PrismaIntegrationClientMapper.toDomain(record) : null;
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<IntegrationClient | null> {
    // Id fora do formato não existe (e não chega ao Postgres como uuid).
    if (!isUuid(id)) return null;
    const record = await this.clients.current().integrationClient.findFirst({
      where: { id, organizationId },
    });
    return record ? PrismaIntegrationClientMapper.toDomain(record) : null;
  }

  async listByOrganization(
    organizationId: string,
  ): Promise<IntegrationClient[]> {
    const records = await this.clients.current().integrationClient.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return records.map(PrismaIntegrationClientMapper.toDomain);
  }

  countLiveByOrganization(organizationId: string): Promise<number> {
    return this.clients.current().integrationClient.count({
      where: {
        organizationId,
        status: {
          in: [
            PrismaIntegrationClientStatus.PROVISIONING,
            PrismaIntegrationClientStatus.ACTIVE,
          ],
        },
      },
    });
  }

  async listProvisioning(): Promise<IntegrationClient[]> {
    const records = await this.clients.current().integrationClient.findMany({
      where: { status: PrismaIntegrationClientStatus.PROVISIONING },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return records.map(PrismaIntegrationClientMapper.toDomain);
  }

  async create(client: IntegrationClient): Promise<void> {
    await this.clients.current().integrationClient.create({
      data: PrismaIntegrationClientMapper.toPersistence(client),
    });
  }

  async save(client: IntegrationClient): Promise<void> {
    const { clientId, status, revokedAt, revokedByUserId, updatedAt } =
      PrismaIntegrationClientMapper.toPersistence(client);
    await this.clients.current().integrationClient.update({
      where: { id: client.id },
      data: { clientId, status, revokedAt, revokedByUserId, updatedAt },
    });
  }
}
