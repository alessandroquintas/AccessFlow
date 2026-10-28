import { OrganizationRole } from '@/modules/organizations/application/dto/organization-role';
import { Role } from '@/modules/organizations/domain/entities/role.entity';
import { Field, ObjectType } from '@nestjs/graphql';
import { RoleSummaryType } from './role-summary.type';

/**
 * O papel completo, com permissões e contagem. Só sai em operações de papel
 * (roles:read ou roles:manage) e no papel do próprio viewer. `permissions` e
 * `memberCount` são resolvidos no RolesResolver.
 */
@ObjectType('OrganizationRole')
export class OrganizationRoleType extends RoleSummaryType {
  @Field()
  createdAt!: Date;

  /** Não exposto: o papel, para resolver as permissões efetivas. */
  source!: Role;

  /** Não exposto: para carregar o que não veio pronto do caso de uso. */
  organizationId!: string;

  /** Não exposto: o memberCount, quando o caso de uso já o calculou. */
  knownMemberCount?: number;

  static from(role: Role, memberCount?: number): OrganizationRoleType {
    const type = new OrganizationRoleType();
    type.id = role.id;
    type.name = role.name;
    type.systemKey = role.systemKey;
    type.createdAt = role.createdAt;
    type.source = role;
    type.organizationId = role.organizationId;
    type.knownMemberCount = memberCount;
    return type;
  }

  static fromOrganizationRole({ role, memberCount }: OrganizationRole) {
    return OrganizationRoleType.from(role, memberCount);
  }
}
