import {
  AuditActorType as PrismaAuditActorType,
  Prisma,
  type AuditEvent as PrismaAuditEvent,
} from '@prisma/client';
import {
  AuditAction,
  AuditActor,
  AuditActorType,
  AuditDetails,
  AuditEvent,
  AuditTargetType,
} from '@/modules/organizations/domain/entities/audit-event.entity';

const ACTOR_TYPE_TO_PERSISTENCE: Record<AuditActorType, PrismaAuditActorType> =
  {
    USER: PrismaAuditActorType.USER,
    MACHINE: PrismaAuditActorType.MACHINE,
    SYSTEM: PrismaAuditActorType.SYSTEM,
  };

/** O ator a partir das colunas; o CHECK da tabela garante a coerência. */
function actorOf(record: PrismaAuditEvent): AuditActor {
  switch (record.actorType) {
    case PrismaAuditActorType.USER:
      return { type: AuditActorType.USER, userId: record.actorUserId! };
    case PrismaAuditActorType.MACHINE:
      return { type: AuditActorType.MACHINE, clientId: record.actorClientId! };
    case PrismaAuditActorType.SYSTEM:
      return { type: AuditActorType.SYSTEM };
  }
}

export class PrismaAuditEventMapper {
  /** action e target_type são texto: o restore recusa valor fora do catálogo. */
  static toDomain(record: PrismaAuditEvent): AuditEvent {
    return AuditEvent.restore({
      id: record.id,
      organizationId: record.organizationId,
      actor: actorOf(record),
      action: record.action as AuditAction,
      target: {
        type: record.targetType as AuditTargetType,
        id: record.targetId,
      },
      details: record.details as AuditDetails,
      occurredAt: record.occurredAt,
    });
  }

  static toPersistence(
    event: AuditEvent,
  ): Prisma.AuditEventUncheckedCreateInput {
    const { actor } = event;
    return {
      id: event.id,
      organizationId: event.organizationId,
      actorType: ACTOR_TYPE_TO_PERSISTENCE[actor.type],
      actorUserId: actor.type === AuditActorType.USER ? actor.userId : null,
      actorClientId:
        actor.type === AuditActorType.MACHINE ? actor.clientId : null,
      action: event.action,
      targetType: event.target.type,
      targetId: event.target.id,
      details: event.details as Prisma.InputJsonObject,
      occurredAt: event.occurredAt,
    };
  }
}
