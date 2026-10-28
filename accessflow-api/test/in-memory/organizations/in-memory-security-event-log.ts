import {
  SecurityActorType,
  SecurityEvent,
} from '@/modules/organizations/domain/entities/security-event.entity';
import {
  RecordedSecurityEvent,
  SecurityEventCursor,
  SecurityEventFilter,
  SecurityEventLog,
  SecurityEventPage,
} from '@/modules/organizations/domain/repositories/security-event-log.repository';
import { RequestContextPort } from '@/shared/application/ports/request-context.port';

function copy(event: SecurityEvent): SecurityEvent {
  return SecurityEvent.restore({
    id: event.id,
    organizationId: event.organizationId,
    actor: event.actor,
    event: event.event,
    details: event.details,
    occurredAt: event.occurredAt,
  });
}

/** Mais recente primeiro; o id desempata (mesma ordem do uuid no Postgres). */
function compareNewestFirst(a: SecurityEvent, b: SecurityEvent): number {
  const byDate = b.occurredAt.getTime() - a.occurredAt.getTime();
  if (byDate !== 0) return byDate;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

function isAfter(event: SecurityEvent, cursor: SecurityEventCursor): boolean {
  const byDate = event.occurredAt.getTime() - cursor.occurredAt.getTime();
  return byDate < 0 || (byDate === 0 && event.id < cursor.id);
}

function matches(event: SecurityEvent, filter: SecurityEventFilter): boolean {
  const { actor } = event;
  const time = event.occurredAt.getTime();
  return (
    (!filter.events?.length || filter.events.includes(event.event)) &&
    (!filter.actorUserId ||
      (actor.type === SecurityActorType.USER &&
        actor.userId === filter.actorUserId)) &&
    (!filter.actorClientId ||
      (actor.type === SecurityActorType.MACHINE &&
        actor.clientId === filter.actorClientId)) &&
    (!filter.occurredFrom || time >= filter.occurredFrom.getTime()) &&
    (!filter.occurredTo || time <= filter.occurredTo.getTime())
  );
}

/** Só grava e lista, como a tabela; guarda cópias. */
export class InMemorySecurityEventLog extends SecurityEventLog {
  private readonly rows: RecordedSecurityEvent[] = [];
  private failure: Error | null = null;

  /** Sem contexto, como fora de uma requisição: requestId null. */
  constructor(private readonly requestContext?: RequestContextPort) {
    super();
  }

  get items(): RecordedSecurityEvent[] {
    return this.rows.map(({ event, requestId }) => ({
      event: copy(event),
      requestId,
    }));
  }

  /** A próxima gravação (e as seguintes) lança este erro. */
  failWith(error: Error): void {
    this.failure = error;
  }

  async record(event: SecurityEvent): Promise<void> {
    if (this.failure) throw this.failure;
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
    }: {
      first: number;
      after?: SecurityEventCursor;
      filter?: SecurityEventFilter;
    },
  ): Promise<SecurityEventPage> {
    const found = this.items
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
