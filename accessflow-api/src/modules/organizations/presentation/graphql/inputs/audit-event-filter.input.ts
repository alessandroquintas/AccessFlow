import { Field, ID, InputType } from '@nestjs/graphql';

@InputType('AuditEventFilter')
export class AuditEventFilterInput {
  @Field(() => [String], {
    nullable: true,
    description:
      'Qualquer uma destas ações. Ação fora do catálogo responde BAD_REQUEST; lista vazia não filtra.',
  })
  actions?: string[] | null;

  @Field(() => ID, { nullable: true })
  actorUserId?: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      'organization, member, invitation, role, permission ou integration.',
  })
  targetType?: string | null;

  @Field(() => ID, { nullable: true })
  targetId?: string | null;

  @Field(() => Date, {
    nullable: true,
    description: 'Inclusive. Depois de occurredTo responde BAD_REQUEST.',
  })
  occurredFrom?: Date | null;

  @Field(() => Date, { nullable: true, description: 'Inclusive.' })
  occurredTo?: Date | null;
}
