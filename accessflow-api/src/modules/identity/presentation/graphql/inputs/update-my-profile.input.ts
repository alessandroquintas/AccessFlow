import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateMyProfileInput {
  @Field({ description: 'Novo nome de exibição (2 a 100 caracteres).' })
  name!: string;
}
