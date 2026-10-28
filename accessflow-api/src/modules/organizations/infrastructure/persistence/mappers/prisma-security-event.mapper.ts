import {
  Prisma,
  SecurityActorType as PrismaSecurityActorType,
  type SecurityEvent as PrismaSecurityEvent,
} from '@prisma/client';
import {
  SecurityActor,
  SecurityActorType,
  SecurityDetails,
  SecurityEvent,
  SecurityEventType,
} from '@/modules/organizations/domain/entities/security-event.entity';

const ACTOR_TYPE_TO_PERSISTENCE: Record<
  SecurityActorType,
  PrismaSecurityActorType
> = {
  USER: PrismaSecurityActorType.USER,
  MACHINE: PrismaSecurityActorType.MACHINE,
};

/** O ator a partir das colunas; o CHECK da tabela garante a coerência. */
function actorOf(record: PrismaSecurityEvent): SecurityActor {
  switch (record.actorType) {
    case PrismaSecurityActorType.USER:
      return { type: SecurityActorType.USER, userId: record.actorUserId! };
    case PrismaSecurityActorType.MACHINE:
      return {
        type: SecurityActorType.MACHINE,
        clientId: record.actorClientId!,
      };
  }
}

export class PrismaSecurityEventMapper {
  /** event é texto: o restore recusa valor fora do catálogo. */
  static toDomain(record: PrismaSecurityEvent): SecurityEvent {
    return SecurityEvent.restore({
      id: record.id,
      organizationId: record.organizationId,
      actor: actorOf(record),
      event: record.event as SecurityEventType,
      details: record.details as SecurityDetails,
      occurredAt: record.occurredAt,
    });
  }

  static toPersistence(
    event: SecurityEvent,
  ): Prisma.SecurityEventUncheckedCreateInput {
    const { actor } = event;
    return {
      id: event.id,
      organizationId: event.organizationId,
      actorType: ACTOR_TYPE_TO_PERSISTENCE[actor.type],
      actorUserId: actor.type === SecurityActorType.USER ? actor.userId : null,
      actorClientId:
        actor.type === SecurityActorType.MACHINE ? actor.clientId : null,
      event: event.event,
      details: event.details as Prisma.InputJsonObject,
      occurredAt: event.occurredAt,
    };
  }
}
