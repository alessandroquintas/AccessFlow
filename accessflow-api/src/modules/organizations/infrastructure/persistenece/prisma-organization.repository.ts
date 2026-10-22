import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { OrganizationRepository } from '@/modules/organizations/domain/repositories/organization.repository';
import { SlugAlreadyTakenError } from '@/modules/organizations/domain/errors/slug-already-taken.error';
import { PrismaOrganizationMapper } from './mappers/prisma-organization.mapper';
import { PrismaMembershipMapper } from './mappers/prisma-membership.mapper';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

function isUniqueViolationOn(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION &&
    String(error.meta?.target ?? '').includes(field)
  );
}

@Injectable()
export class PrismaOrganizationRepository extends OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<Organization | null> {
    const record = await this.prisma.organization.findUnique({
      where: { id },
    });
    return record ? PrismaOrganizationMapper.toDomain(record) : null;
  }

  async findByIds(ids: string[]): Promise<Organization[]> {
    if (ids.length === 0) {
      return [];
    }

    const records = await this.prisma.organization.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return records.map(PrismaOrganizationMapper.toDomain);
  }

  async createWithOwner(
    organization: Organization,
    owner: Membership,
  ): Promise<void> {
    try {
      await this.prisma.$transaction([
        this.prisma.organization.create({
          data: PrismaOrganizationMapper.toPersistence(organization),
        }),
        this.prisma.membership.create({
          data: PrismaMembershipMapper.toPersistence(owner),
        }),
      ]);
    } catch (error) {
      if (isUniqueViolationOn(error, 'slug')) throw new SlugAlreadyTakenError();
      throw error;
    }
  }

  async save(organization: Organization): Promise<void> {
    const { id, ...data } =
      PrismaOrganizationMapper.toPersistence(organization);

    await this.prisma.organization.update({
      where: {
        id,
      },
      data,
    });
  }
}
