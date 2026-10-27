import { OrganizationMember } from '@/modules/organizations/application/dto/organization-member';
import { MembershipRole, membershipRoleOf } from '../../membership-role';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { OrganizationRoleType } from './organization-role.type';

@ObjectType('OrganizationMember')
export class OrganizationMemberType {
  @Field(() => ID)
  userId!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field(() => MembershipRole, { deprecationReason: 'Use assignedRole.' })
  role!: MembershipRole;

  @Field(() => OrganizationRoleType)
  assignedRole!: OrganizationRoleType;

  @Field({
    description:
      'Data da primeira entrada na organização. Não muda se o membro sair e voltar por um novo convite.',
  })
  joinedAt!: Date;

  static from({
    membership,
    profile,
    role,
  }: OrganizationMember): OrganizationMemberType {
    const type = new OrganizationMemberType();
    type.userId = membership.userId;
    type.name = profile.name;
    type.email = profile.email;
    type.role = membershipRoleOf(role);
    type.assignedRole = OrganizationRoleType.from(role);
    type.joinedAt = membership.createdAt;
    return type;
  }
}
