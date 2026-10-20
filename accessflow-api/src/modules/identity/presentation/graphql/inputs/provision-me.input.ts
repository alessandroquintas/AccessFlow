import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class ProvisionMeInput {
  @Field({ description: 'Nome de exibição (2 a 100 caracteres).' })
  name!: string;
}
