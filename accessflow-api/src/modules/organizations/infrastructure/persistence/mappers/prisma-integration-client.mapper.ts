import {
  Prisma,
  IntegrationClientStatus as PrismaIntegrationClientStatus,
  type IntegrationClient as PrismaIntegrationClient,
} from '@prisma/client';
import type { MachineScope } from '@/shared/domain/machine-scope';
import {
  IntegrationClient,
  IntegrationClientStatus,
} from '@/modules/organizations/domain/entities/integration-client.entity';

const STATUS_TO_DOMAIN: Record<
  PrismaIntegrationClientStatus,
  IntegrationClientStatus
> = {
  PROVISIONING: IntegrationClientStatus.PROVISIONING,
  ACTIVE: IntegrationClientStatus.ACTIVE,
  REVOKED: IntegrationClientStatus.REVOKED,
  FAILED: IntegrationClientStatus.FAILED,
};

const STATUS_TO_PERSISTENCE: Record<
  IntegrationClientStatus,
  PrismaIntegrationClientStatus
> = {
  PROVISIONING: PrismaIntegrationClientStatus.PROVISIONING,
  ACTIVE: PrismaIntegrationClientStatus.ACTIVE,
  REVOKED: PrismaIntegrationClientStatus.REVOKED,
  FAILED: PrismaIntegrationClientStatus.FAILED,
};

export class PrismaIntegrationClientMapper {
  /** Escopos fora do catálogo: o restore recusa (dado corrompido). */
  static toDomain(record: PrismaIntegrationClient): IntegrationClient {
    return IntegrationClient.restore({
      id: record.id,
      organizationId: record.organizationId,
      clientId: record.clientId,
      name: record.name,
      scopes: record.scopes as MachineScope[],
      status: STATUS_TO_DOMAIN[record.status],
      createdByUserId: record.createdByUserId,
      revokedAt: record.revokedAt,
      revokedByUserId: record.revokedByUserId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(
    client: IntegrationClient,
  ): Prisma.IntegrationClientUncheckedCreateInput {
    return {
      id: client.id,
      organizationId: client.organizationId,
      clientId: client.clientId,
      name: client.name,
      scopes: [...client.scopes],
      status: STATUS_TO_PERSISTENCE[client.status],
      createdByUserId: client.createdByUserId,
      revokedAt: client.revokedAt,
      revokedByUserId: client.revokedByUserId,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }
}
