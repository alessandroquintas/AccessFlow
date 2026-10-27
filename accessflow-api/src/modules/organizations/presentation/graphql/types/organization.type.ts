import { OrganizationWithMembership } from '@/modules/organizations/application/dto/organization-with-membership';
import { MembershipRole, membershipRoleOf } from '../../membership-role';
import { OrganizationStatus } from '@/modules/organizations/domain/entities/organization.entity';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(OrganizationStatus, { name: 'OrganizationStatus' });
registerEnumType(MembershipRole, { name: 'MembershipRole' });

@ObjectType('Organization')
export class OrganizationType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  slug!: string;

  @Field(() => OrganizationStatus)
  status!: OrganizationStatus;

  @Field()
  createdAt!: Date;

  @Field(() => MembershipRole, {
    description: 'Papel do usuário autenticado nesta organização.',
  })
  viewerRole!: MembershipRole;

  static from({
    organization,
    role,
  }: OrganizationWithMembership): OrganizationType {
    const type = new OrganizationType();
    type.id = organization.id;
    type.name = organization.name;
    type.slug = organization.slug;
    type.status = organization.status;
    type.createdAt = organization.createdAt;
    type.viewerRole = membershipRoleOf(role);
    return type;
  }
}
