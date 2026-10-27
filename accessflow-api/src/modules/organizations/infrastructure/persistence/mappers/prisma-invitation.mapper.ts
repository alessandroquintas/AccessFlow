import {
  Prisma,
  InvitationStatus as PrismaInvitationStatus,
  type Invitation as PrismaInvitation,
} from '@prisma/client';
import {
  Invitation,
  InvitationStatus,
} from '@/modules/organizations/domain/entities/invitation.entity';

const STATUS_TO_DOMAIN: Record<PrismaInvitationStatus, InvitationStatus> = {
  PENDING: InvitationStatus.PENDING,
  ACCEPTED: InvitationStatus.ACCEPTED,
  DECLINED: InvitationStatus.DECLINED,
  REVOKED: InvitationStatus.REVOKED,
};

const STATUS_TO_PERSISTENCE: Record<InvitationStatus, PrismaInvitationStatus> =
  {
    PENDING: PrismaInvitationStatus.PENDING,
    ACCEPTED: PrismaInvitationStatus.ACCEPTED,
    DECLINED: PrismaInvitationStatus.DECLINED,
    REVOKED: PrismaInvitationStatus.REVOKED,
  };

export class PrismaInvitationMapper {
  static toDomain(record: PrismaInvitation): Invitation {
    return Invitation.restore({
      id: record.id,
      organizationId: record.organizationId,
      email: record.email,
      roleId: record.roleId,
      status: STATUS_TO_DOMAIN[record.status],
      invitedByUserId: record.invitedByUserId,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(
    invitation: Invitation,
  ): Prisma.InvitationUncheckedCreateInput {
    return {
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
      roleId: invitation.roleId,
      status: STATUS_TO_PERSISTENCE[invitation.status],
      invitedByUserId: invitation.invitedByUserId,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
    };
  }
}
