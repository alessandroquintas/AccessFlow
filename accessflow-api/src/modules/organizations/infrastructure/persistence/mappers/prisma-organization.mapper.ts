import {
  Prisma,
  OrganizationStatus as PrismaOrganizationStatus,
  type Organization as PrismaOrganization,
} from '@prisma/client';
import {
  Organization,
  OrganizationStatus,
} from '@/modules/organizations/domain/entities/organization.entity';

const STATUS_TO_DOMAIN: Record<PrismaOrganizationStatus, OrganizationStatus> = {
  ACTIVE: OrganizationStatus.ACTIVE,
  INACTIVE: OrganizationStatus.INACTIVE,
};

const STATUS_TO_PERSISTENCE: Record<
  OrganizationStatus,
  PrismaOrganizationStatus
> = {
  ACTIVE: PrismaOrganizationStatus.ACTIVE,
  INACTIVE: PrismaOrganizationStatus.INACTIVE,
};

export class PrismaOrganizationMapper {
  static toDomain(record: PrismaOrganization): Organization {
    return Organization.restore({
      id: record.id,
      name: record.name,
      slug: record.slug,
      status: STATUS_TO_DOMAIN[record.status],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(
    organization: Organization,
  ): Prisma.OrganizationUncheckedCreateInput {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: STATUS_TO_PERSISTENCE[organization.status],
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };
  }
}
