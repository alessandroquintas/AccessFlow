import {
  IntegrationClientStatus as PrismaIntegrationClientStatus,
  type IntegrationClient as PrismaIntegrationClient,
} from '@prisma/client';
import {
  IntegrationClient,
  IntegrationClientStatus,
} from '@/modules/organizations/domain/entities/integration-client.entity';

const STATUS_TO_DOMAIN: Record<
  PrismaIntegrationClientStatus,
  IntegrationClientStatus
> = {
  ACTIVE: IntegrationClientStatus.ACTIVE,
  REVOKED: IntegrationClientStatus.REVOKED,
};

export class PrismaIntegrationClientMapper {
  static toDomain(record: PrismaIntegrationClient): IntegrationClient {
    return IntegrationClient.restore({
      id: record.id,
      clientId: record.clientId,
      organizationId: record.organizationId,
      name: record.name,
      status: STATUS_TO_DOMAIN[record.status],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
