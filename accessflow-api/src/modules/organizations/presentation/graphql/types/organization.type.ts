import { OrganizationWithMembership } from '@/modules/organizations/application/dto/organization-with-membership';
import { MembershipRole } from '@/modules/organizations/domain/entities/membership.entity';
import { OrganizationStatus } from '@/modules/organizations/domain/entities/organization.entity';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(OrganizationStatus, { name: 'OrganizationStatus' });
registerEnumType(MembershipRole, { name: 'MembershipRole' });

@ObjectType('Organization')
export class OrganizationTypes {
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
    membership,
  }: OrganizationWithMembership): OrganizationTypes {
    const type = new OrganizationTypes();
    type.id = organization.id;
    type.name = organization.name;
    type.slug = organization.slug;
    type.status = organization.status;
    type.createdAt = organization.createdAt;
    type.viewerRole = membership.role;
    return type;
  }
}
