import { Field, ID, InputType } from '@nestjs/graphql';

@InputType('AuthorizationDecisionFilter')
export class AuthorizationDecisionFilterInput {
  @Field(() => ID, { nullable: true })
  subjectUserId?: string | null;

  @Field(() => String, { nullable: true })
  clientId?: string | null;

  @Field(() => Boolean, {
    nullable: true,
    description: 'true: tudo permitido; false: alguma chave negada.',
  })
  allowed?: boolean | null;

  @Field(() => String, {
    nullable: true,
    description:
      'Decisões em que esta chave estava entre as pedidas, permitida ou não. Fora do formato recurso:ação responde BAD_REQUEST.',
  })
  permission?: string | null;

  @Field(() => Date, {
    nullable: true,
    description: 'Inclusive. Depois de decidedTo responde BAD_REQUEST.',
  })
  decidedFrom?: Date | null;

  @Field(() => Date, { nullable: true, description: 'Inclusive.' })
  decidedTo?: Date | null;
}
