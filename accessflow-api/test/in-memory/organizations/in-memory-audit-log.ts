import {
  AuditActorType,
  AuditEvent,
} from '@/modules/organizations/domain/entities/audit-event.entity';
import {
  AuditEventCursor,
  AuditEventFilter,
  AuditEventPage,
  AuditLog,
  RecordedAuditEvent,
} from '@/modules/organizations/domain/repositories/audit-log.repository';
import { RequestContextPort } from '@/shared/application/ports/request-context.port';

function copy(event: AuditEvent): AuditEvent {
  return AuditEvent.restore({
    id: event.id,
    organizationId: event.organizationId,
    actor: event.actor,
    action: event.action,
    target: event.target,
    details: event.details,
    occurredAt: event.occurredAt,
  });
}

/** Mais recente primeiro; o id desempata (mesma ordem do uuid no Postgres). */
function compareNewestFirst(a: AuditEvent, b: AuditEvent): number {
  const byDate = b.occurredAt.getTime() - a.occurredAt.getTime();
  if (byDate !== 0) return byDate;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

function isAfter(event: AuditEvent, cursor: AuditEventCursor): boolean {
  const byDate = event.occurredAt.getTime() - cursor.occurredAt.getTime();
  return byDate < 0 || (byDate === 0 && event.id < cursor.id);
}

function matches(event: AuditEvent, filter: AuditEventFilter): boolean {
  const time = event.occurredAt.getTime();
  return (
    (!filter.actions?.length || filter.actions.includes(event.action)) &&
    (!filter.actorUserId ||
      (event.actor.type === AuditActorType.USER &&
        event.actor.userId === filter.actorUserId)) &&
    (!filter.targetType || event.target.type === filter.targetType) &&
    (!filter.targetId || event.target.id === filter.targetId) &&
    (!filter.occurredFrom || time >= filter.occurredFrom.getTime()) &&
    (!filter.occurredTo || time <= filter.occurredTo.getTime())
  );
}

/** Só grava e lista, como a tabela; guarda cópias. */
export class InMemoryAuditLog extends AuditLog {
  private readonly rows: RecordedAuditEvent[] = [];

  /** Sem contexto, como fora de uma requisição: requestId null. */
  constructor(private readonly requestContext?: RequestContextPort) {
    super();
  }

  get items(): AuditEvent[] {
    return this.rows.map(({ event }) => copy(event));
  }

  async record(event: AuditEvent): Promise<void> {
    this.rows.push({
      event: copy(event),
      requestId: this.requestContext?.requestId() ?? null,
    });
  }

  async listByOrganization(
    organizationId: string,
    {
      first,
      after,
      filter = {},
    }: { first: number; after?: AuditEventCursor; filter?: AuditEventFilter },
  ): Promise<AuditEventPage> {
    const found = this.rows
      .map(({ event, requestId }) => ({ event: copy(event), requestId }))
      .filter(({ event }) => event.organizationId === organizationId)
      .filter(({ event }) => matches(event, filter))
      .filter(({ event }) => !after || isAfter(event, after))
      .sort((a, b) => compareNewestFirst(a.event, b.event));

    return {
      items: found.slice(0, first),
      hasNextPage: found.length > first,
    };
  }
}
