import { OrganizationRole } from '@/modules/organizations/application/dto/organization-role';
import {
  Role,
  RoleSystemKey,
} from '@/modules/organizations/domain/entities/role.entity';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(RoleSystemKey, {
  name: 'RoleSystemKey',
  description: 'Papéis com que toda organização nasce.',
});

/** `memberCount` é resolvido no RolesResolver. */
@ObjectType('OrganizationRole')
export class OrganizationRoleType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => RoleSystemKey, {
    nullable: true,
    description: 'Nulo em papel personalizado.',
  })
  systemKey!: RoleSystemKey | null;

  @Field(() => [String], {
    description:
      'Permissões efetivas, na ordem do catálogo. O OWNER tem o catálogo inteiro.',
  })
  permissions!: string[];

  @Field()
  createdAt!: Date;

  /** Não exposto: para carregar o memberCount quando ele não veio pronto. */
  organizationId!: string;

  /** Não exposto: o memberCount, quando o caso de uso já o calculou. */
  knownMemberCount?: number;

  static from(role: Role, memberCount?: number): OrganizationRoleType {
    const type = new OrganizationRoleType();
    type.id = role.id;
    type.name = role.name;
    type.systemKey = role.systemKey;
    type.permissions = [...role.effectivePermissions()];
    type.createdAt = role.createdAt;
    type.organizationId = role.organizationId;
    type.knownMemberCount = memberCount;
    return type;
  }

  static fromSummary({ role, memberCount }: OrganizationRole) {
    return OrganizationRoleType.from(role, memberCount);
  }
}
