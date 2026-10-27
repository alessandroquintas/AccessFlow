import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateRoleInput {
  @Field({
    description:
      'Nome (1 a 50 caracteres), único na organização sem diferenciar maiúsculas e minúsculas.',
  })
  name!: string;

  @Field(() => [String], {
    description:
      'Chaves do permissionCatalog; repetidas são ignoradas. Só é possível conceder permissões que você tem.',
  })
  permissions!: string[];
}
