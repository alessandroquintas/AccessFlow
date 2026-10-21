import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateOrganizationInput {
  @Field({ description: 'Nome de exibição (2 a 100 caracteres).' })
  name!: string;

  @Field({
    description:
      'Identificador para URLs: letras minúsculas, números e hífens (3 a 50).',
  })
  slug!: string;
}
