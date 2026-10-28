import { AuditEventEntry } from '@/modules/organizations/application/dto/audit-event-entry';
import { AuditActorType } from '@/modules/organizations/domain/entities/audit-event.entity';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(AuditActorType, {
  name: 'AuditActorType',
  description: 'Na Fase 9a só USER é emitido.',
});

@ObjectType('AuditActor')
export class AuditActorGqlType {
  @Field(() => AuditActorType)
  type!: AuditActorType;

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

@ObjectType('AuditTarget')
export class AuditTargetGqlType {
  @Field({
    description: 'organization, member, invitation, role ou permission.',
  })
  type!: string;

  @Field(() => ID, {
    description: 'Id do alvo: o userId para member e a chave para permission.',
  })
  id!: string;
}

@ObjectType('AuditEvent')
export class AuditEventGqlType {
  @Field(() => ID)
  id!: string;

  @Field({ description: 'Ex.: role.created, member.role_changed.' })
  action!: string;

  @Field()
  occurredAt!: Date;

  @Field(() => AuditActorGqlType)
  actor!: AuditActorGqlType;

  @Field(() => AuditTargetGqlType)
  target!: AuditTargetGqlType;

  @Field({
    description:
      'Detalhes da ação como JSON serializado (um objeto). O formato depende da ação; sem e-mail nem nome de pessoa.',
  })
  details!: string;

  static from({ event, actorName }: AuditEventEntry): AuditEventGqlType {
    const { actor } = event;
    const type = new AuditEventGqlType();
    type.id = event.id;
    type.action = event.action;
    type.occurredAt = event.occurredAt;
    type.actor = {
      type: actor.type,
      userId: actor.type === AuditActorType.USER ? actor.userId : null,
      name: actorName,
      clientId: actor.type === AuditActorType.MACHINE ? actor.clientId : null,
    };
    type.target = { type: event.target.type, id: event.target.id };
    type.details = JSON.stringify(event.details);
    return type;
  }
}
