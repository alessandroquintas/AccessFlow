import { RecordedAuthorizationDecision } from '@/modules/organizations/domain/repositories/authorization-decision-log.repository';
import { REQUEST_ID_DESCRIPTION } from '@/shared/presentation/graphql/request-id-field';
import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('AuthorizationDecisionResult')
export class AuthorizationDecisionResultGqlType {
  @Field({ description: 'Chave pedida, no formato recurso:ação.' })
  permission!: string;

  @Field()
  allowed!: boolean;
}

@ObjectType('AuthorizationDecision')
export class AuthorizationDecisionGqlType {
  @Field(() => ID)
  id!: string;

  @Field({ description: 'client_id da integração que perguntou.' })
  clientId!: string;

  @Field(() => ID, {
    description: 'Sobre quem se perguntou; pode nem existir como usuário.',
  })
  subjectUserId!: string;

  @Field({ description: 'true só se todas as chaves foram permitidas.' })
  allowed!: boolean;

  @Field(() => [AuthorizationDecisionResultGqlType], {
    description: 'Na ordem do pedido, sem as repetidas.',
  })
  results!: AuthorizationDecisionResultGqlType[];

  @Field()
  decidedAt!: Date;

  @Field(() => String, {
    nullable: true,
    description: REQUEST_ID_DESCRIPTION,
  })
  requestId!: string | null;

  static from({
    decision,
    requestId,
  }: RecordedAuthorizationDecision): AuthorizationDecisionGqlType {
    const type = new AuthorizationDecisionGqlType();
    type.id = decision.id;
    type.clientId = decision.clientId;
    type.subjectUserId = decision.subjectUserId;
    type.allowed = decision.allowed;
    type.results = decision.results.map(({ permission, allowed }) => ({
      permission,
      allowed,
    }));
    type.decidedAt = decision.decidedAt;
    type.requestId = requestId;
    return type;
  }
}
