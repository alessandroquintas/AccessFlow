import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateRoleInput {
  @Field(() => ID)
  roleId!: string;

  @Field(() => String, {
    nullable: true,
    description:
      'Ausente ou nulo: não muda. Papéis de sistema não mudam de nome.',
  })
  name?: string | null;

  @Field(() => [String], {
    nullable: true,
    description:
      'Substitui todas as permissões. Ausente ou nulo: não muda. Só é possível adicionar ou remover permissões que você tem.',
  })
  permissions?: string[] | null;
}
