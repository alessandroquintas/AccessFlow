import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreatePermissionInput {
  @Field({
    description:
      'recurso:ação em minúsculas, dígitos e hífen, até 40 caracteres de cada lado. Não muda depois de criada. Recursos do sistema são reservados.',
  })
  key!: string;

  @Field({ description: 'De 1 a 200 caracteres.' })
  description!: string;
}
