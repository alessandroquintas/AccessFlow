import { OrganizationPermissionEntry } from '@/modules/organizations/application/dto/organization-permission-entry';
import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('OrganizationPermission')
export class OrganizationPermissionType {
  @Field()
  key!: string;

  @Field()
  description!: string;

  @Field({
    description:
      'Do catálogo de sistema: não pode ser editada nem excluída. As personalizadas são da organização.',
  })
  isSystem!: boolean;

  static from({
    key,
    description,
    isSystem,
  }: OrganizationPermissionEntry): OrganizationPermissionType {
    const type = new OrganizationPermissionType();
    type.key = key;
    type.description = description;
    type.isSystem = isSystem;
    return type;
  }
}
