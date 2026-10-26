import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { IntegrationClient } from '@/modules/organizations/domain/entities/integration-client.entity';
import { IntegrationClientRepository } from '@/modules/organizations/domain/repositories/integration-client.repository';
import { PrismaIntegrationClientMapper } from './mappers/prisma-integration-client.mapper';

@Injectable()
export class PrismaIntegrationClientRepository extends IntegrationClientRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByClientId(clientId: string): Promise<IntegrationClient | null> {
    const record = await this.prisma.integrationClient.findUnique({
      where: {
        clientId,
      },
    });
    return record ? PrismaIntegrationClientMapper.toDomain(record) : null;
  }
}
