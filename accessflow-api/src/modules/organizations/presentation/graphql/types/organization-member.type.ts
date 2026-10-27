import { OrganizationMember } from '@/modules/organizations/application/dto/organization-member';
import { MembershipRole, membershipRoleOf } from '../../membership-role';
import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('OrganizationMember')
export class OrganizationMemberType {
  @Field(() => ID)
  userId!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field(() => MembershipRole)
  role!: MembershipRole;

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
    type.joinedAt = membership.createdAt;
    return type;
  }
}
