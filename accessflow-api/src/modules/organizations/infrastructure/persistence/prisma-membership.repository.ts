import { Injectable } from '@nestjs/common';
import { MembershipStatus as PrismaMembershipStatus } from '@prisma/client';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { MembershipRepository } from '@/modules/organizations/domain/repositories/membership.repository';
import { PrismaMembershipMapper } from './mappers/prisma-membership.mapper';

@Injectable()
export class PrismaMembershipRepository extends MembershipRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByOrganizationAndUser(
    organizationId: string,
    userId: string,
  ): Promise<Membership | null> {
    const record = await this.prisma.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });
    return record ? PrismaMembershipMapper.toDomain(record) : null;
  }

  async listActiveByUser(userId: string): Promise<Membership[]> {
    const records = await this.prisma.membership.findMany({
      where: {
        userId,
        status: PrismaMembershipStatus.ACTIVE,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    return records.map(PrismaMembershipMapper.toDomain);
  }
}
