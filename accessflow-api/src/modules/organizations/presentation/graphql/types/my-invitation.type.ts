import { MyInvitation } from '@/modules/organizations/application/dto/my-invitation';
import { MembershipRole, membershipRoleOf } from '../../membership-role';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { RoleSummaryType } from './role-summary.type';

/** Só o que o convidado precisa para decidir: ele ainda não é membro. */
@ObjectType('InvitationOrganization')
export class InvitationOrganizationType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  slug!: string;
}

@ObjectType('MyInvitation')
export class MyInvitationType {
  @Field(() => ID)
  id!: string;

  @Field(() => MembershipRole, {
    description: 'Papel ao aceitar o convite.',
    deprecationReason: 'Use assignedRole.',
  })
  role!: MembershipRole;

  @Field(() => RoleSummaryType, {
    description: 'Papel ao aceitar o convite.',
  })
  assignedRole!: RoleSummaryType;

  @Field()
  expiresAt!: Date;

  @Field(() => InvitationOrganizationType)
  organization!: InvitationOrganizationType;

  @Field({ description: 'Nome de quem fez o convite ou a última renovação.' })
  invitedByName!: string;

  static from({
    invitation,
    organization,
    invitedByName,
    role,
  }: MyInvitation): MyInvitationType {
    const type = new MyInvitationType();
    type.id = invitation.id;
    type.role = membershipRoleOf(role);
    type.assignedRole = RoleSummaryType.from(role);
    type.expiresAt = invitation.expiresAt;
    type.organization = {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    };
    type.invitedByName = invitedByName;
    return type;
  }
}
