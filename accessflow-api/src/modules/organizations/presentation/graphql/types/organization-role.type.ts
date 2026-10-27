import { OrganizationRole } from '@/modules/organizations/application/dto/organization-role';
import { Role } from '@/modules/organizations/domain/entities/role.entity';
import { Field, ObjectType } from '@nestjs/graphql';
import { RoleSummaryType } from './role-summary.type';

/**
 * O papel completo, com permissões e contagem. Só sai em operações de papel
 * (roles:read ou roles:manage) e no papel do próprio viewer. `memberCount` é
 * resolvido no RolesResolver.
 */
@ObjectType('OrganizationRole')
export class OrganizationRoleType extends RoleSummaryType {
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

  static fromOrganizationRole({ role, memberCount }: OrganizationRole) {
    return OrganizationRoleType.from(role, memberCount);
  }
}
