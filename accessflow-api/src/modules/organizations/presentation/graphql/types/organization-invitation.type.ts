import { OrganizationInvitation } from '@/modules/organizations/application/dto/organization-invitation';
import {
  Invitation,
  InvitationStatus,
} from '@/modules/organizations/domain/entities/invitation.entity';
import { MembershipRole, membershipRoleOf } from '../../membership-role';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { RoleSummaryType } from './role-summary.type';

/** Status exposto: o do domínio mais EXPIRED, que nunca é gravado. */
export const InvitationStatusView = {
  ...InvitationStatus,
  EXPIRED: 'EXPIRED',
} as const;

export type InvitationStatusView =
  (typeof InvitationStatusView)[keyof typeof InvitationStatusView];

registerEnumType(InvitationStatusView, {
  name: 'InvitationStatus',
  description: 'EXPIRED é calculado: um convite PENDING com o prazo vencido.',
});

export function invitationStatusAt(
  invitation: Invitation,
  now: Date,
): InvitationStatusView {
  return invitation.isExpiredAt(now)
    ? InvitationStatusView.EXPIRED
    : invitation.status;
}

@ObjectType('InvitationInviter')
export class InvitationInviterType {
  @Field(() => ID)
  userId!: string;

  @Field()
  name!: string;
}

@ObjectType('OrganizationInvitation')
export class OrganizationInvitationType {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field(() => MembershipRole, {
    description: 'Papel ao aceitar o convite.',
    deprecationReason: 'Use assignedRole.',
  })
  role!: MembershipRole;

  @Field(() => RoleSummaryType, {
    description: 'Papel ao aceitar o convite.',
  })
  assignedRole!: RoleSummaryType;

  @Field(() => InvitationStatusView)
  status!: InvitationStatusView;

  @Field({
    description: 'Fim do prazo para aceitar. Reconvidar renova por 7 dias.',
  })
  expiresAt!: Date;

  @Field()
  createdAt!: Date;

  @Field(() => InvitationInviterType, {
    description: 'Quem fez o convite ou a última renovação.',
  })
  invitedBy!: InvitationInviterType;

  static from(
    { invitation, invitedBy, role }: OrganizationInvitation,
    now: Date,
  ): OrganizationInvitationType {
    const type = new OrganizationInvitationType();
    type.id = invitation.id;
    type.email = invitation.email;
    type.role = membershipRoleOf(role);
    type.assignedRole = RoleSummaryType.from(role);
    type.status = invitationStatusAt(invitation, now);
    type.expiresAt = invitation.expiresAt;
    type.createdAt = invitation.createdAt;
    type.invitedBy = invitedBy;
    return type;
  }
}
