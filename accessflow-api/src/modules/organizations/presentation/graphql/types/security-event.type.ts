import { SecurityEventEntry } from '@/modules/organizations/application/dto/security-event-entry';
import { SecurityActorType } from '@/modules/organizations/domain/entities/security-event.entity';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { REQUEST_ID_DESCRIPTION } from '@/shared/presentation/graphql/request-id-field';

registerEnumType(SecurityActorType, { name: 'SecurityActorType' });

@ObjectType('SecurityEventActor')
export class SecurityEventActorGqlType {
  @Field(() => SecurityActorType)
  type!: SecurityActorType;

  @Field(() => ID, { nullable: true, description: 'Preenchido quando USER.' })
  userId!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Nome atual do usuário; nulo se o perfil não for encontrado.',
  })
  name!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'client_id da integração, quando MACHINE.',
  })
  clientId!: string | null;
}

@ObjectType('SecurityEvent')
export class SecurityEventGqlType {
  @Field(() => ID)
  id!: string;

  @Field({
    description:
      'access.forbidden, access.privilege_escalation, machine.scope_denied ou machine.organization_denied.',
  })
  event!: string;

  @Field()
  occurredAt!: Date;

  @Field(() => SecurityEventActorGqlType)
  actor!: SecurityEventActorGqlType;

  @Field({
    description:
      'Detalhes como JSON serializado (um objeto): operation e permission nos eventos access.*, route e requiredScopes nos machine.*. Sem e-mail nem nome de pessoa.',
  })
  details!: string;

  @Field(() => String, {
    nullable: true,
    description: REQUEST_ID_DESCRIPTION,
  })
  requestId!: string | null;

  static from({
    event,
    actorName,
    requestId,
  }: SecurityEventEntry): SecurityEventGqlType {
    const { actor } = event;
    const type = new SecurityEventGqlType();
    type.id = event.id;
    type.event = event.event;
    type.occurredAt = event.occurredAt;
    type.actor = {
      type: actor.type,
      userId: actor.type === SecurityActorType.USER ? actor.userId : null,
      name: actorName,
      clientId:
        actor.type === SecurityActorType.MACHINE ? actor.clientId : null,
    };
    type.details = JSON.stringify(event.details);
    type.requestId = requestId;
    return type;
  }
}
