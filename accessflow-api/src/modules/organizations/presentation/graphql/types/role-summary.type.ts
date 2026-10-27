import {
  Role,
  RoleSystemKey,
} from '@/modules/organizations/domain/entities/role.entity';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(RoleSystemKey, {
  name: 'RoleSystemKey',
  description: 'Papéis com que toda organização nasce.',
});

/**
 * Identificação de um papel, sem permissões nem contagem: é o que aparece
 * onde o viewer não precisa ter roles:read (membros e convites).
 */
@ObjectType('RoleSummary')
export class RoleSummaryType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => RoleSystemKey, {
    nullable: true,
    description: 'Nulo em papel personalizado.',
  })
  systemKey!: RoleSystemKey | null;

  static from(role: Role): RoleSummaryType {
    const type = new RoleSummaryType();
    type.id = role.id;
    type.name = role.name;
    type.systemKey = role.systemKey;
    return type;
  }
}
