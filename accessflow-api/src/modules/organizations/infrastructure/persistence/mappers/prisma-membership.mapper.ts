import {
  Prisma,
  MembershipStatus as PrismaMembershipStatus,
  type Membership as PrismaMembership,
} from '@prisma/client';
import {
  Membership,
  MembershipStatus,
} from '@/modules/organizations/domain/entities/membership.entity';

const STATUS_TO_DOMAIN: Record<PrismaMembershipStatus, MembershipStatus> = {
  ACTIVE: MembershipStatus.ACTIVE,
  REMOVED: MembershipStatus.REMOVED,
};

const STATUS_TO_PERSISTENCE: Record<MembershipStatus, PrismaMembershipStatus> =
  {
    ACTIVE: PrismaMembershipStatus.ACTIVE,
    REMOVED: PrismaMembershipStatus.REMOVED,
  };

export class PrismaMembershipMapper {
  static toDomain(record: PrismaMembership): Membership {
    return Membership.restore({
      id: record.id,
      organizationId: record.organizationId,
      userId: record.userId,
      roleId: record.roleId,
      status: STATUS_TO_DOMAIN[record.status],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(
    membership: Membership,
  ): Prisma.MembershipUncheckedCreateInput {
    return {
      id: membership.id,
      organizationId: membership.organizationId,
      userId: membership.userId,
      roleId: membership.roleId,
      status: STATUS_TO_PERSISTENCE[membership.status],
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
    };
  }
}
