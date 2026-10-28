import { Field, ID, InputType } from '@nestjs/graphql';

@InputType('SecurityEventFilter')
export class SecurityEventFilterInput {
  @Field(() => [String], {
    nullable: true,
    description:
      'Qualquer um destes eventos. Evento fora do catálogo responde BAD_REQUEST; lista vazia não filtra.',
  })
  events?: string[] | null;

  @Field(() => ID, { nullable: true })
  actorUserId?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'client_id da integração.',
  })
  actorClientId?: string | null;

  @Field(() => Date, {
    nullable: true,
    description: 'Inclusive. Depois de occurredTo responde BAD_REQUEST.',
  })
  occurredFrom?: Date | null;

  @Field(() => Date, { nullable: true, description: 'Inclusive.' })
  occurredTo?: Date | null;
}
