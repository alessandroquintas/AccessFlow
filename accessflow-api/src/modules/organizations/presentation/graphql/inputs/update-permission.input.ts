import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpdatePermissionInput {
  @Field({ description: 'Chave da permissão personalizada. Não muda.' })
  key!: string;

  @Field({ description: 'Nova descrição, de 1 a 200 caracteres.' })
  description!: string;
}
