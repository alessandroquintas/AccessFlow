import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateIntegrationClientInput {
  @Field({ description: 'Nome (2 a 60 caracteres).' })
  name!: string;

  @Field(() => [String], {
    description:
      'Escopos de máquina (accessflow-api/members.read, accessflow-api/authorize); repetidos são ignorados. members.read exige members:read; authorize exige members:read e roles:read.',
  })
  scopes!: string[];
}
