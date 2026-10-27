import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class AssignRoleInput {
  @Field(() => ID, { description: 'Membro ativo que recebe o papel.' })
  userId!: string;

  @Field(() => ID)
  roleId!: string;
}
