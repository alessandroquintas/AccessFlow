import { Injectable } from '@nestjs/common';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
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
}
