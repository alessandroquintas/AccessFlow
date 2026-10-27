import { PermissionDefinition } from '@/modules/organizations/policies/organization-permission';
import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('PermissionDefinition')
export class PermissionDefinitionType {
  @Field()
  key!: string;

  @Field({ description: 'Texto curto para exibir no front.' })
  description!: string;

  static from({ key, description }: PermissionDefinition) {
    const type = new PermissionDefinitionType();
    type.key = key;
    type.description = description;
    return type;
  }
}
