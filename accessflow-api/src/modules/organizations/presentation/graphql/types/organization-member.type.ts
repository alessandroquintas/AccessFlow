import { OrganizationMember } from '@/modules/organizations/application/dto/organization-member';
import { MembershipRole } from '@/modules/organizations/domain/entities/membership.entity';
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

  @Field({ description: 'Quando o usuário entrou na organização.' })
  joinedAt!: Date;

  static from({
    membership,
    profile,
  }: OrganizationMember): OrganizationMemberType {
    const type = new OrganizationMemberType();
    type.userId = membership.userId;
    type.name = profile.name;
    type.email = profile.email;
    type.role = membership.role;
    type.joinedAt = membership.createdAt;
    return type;
  }
}
