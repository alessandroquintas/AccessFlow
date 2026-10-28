import { AuthorizationDecision } from '@/modules/organizations/domain/entities/authorization-decision.entity';
import {
  AuthorizationDecisionCursor,
  AuthorizationDecisionFilter,
  AuthorizationDecisionLog,
  AuthorizationDecisionPage,
  RecordedAuthorizationDecision,
} from '@/modules/organizations/domain/repositories/authorization-decision-log.repository';
import { RequestContextPort } from '@/shared/application/ports/request-context.port';

function copy(decision: AuthorizationDecision): AuthorizationDecision {
  return AuthorizationDecision.restore({
    id: decision.id,
    organizationId: decision.organizationId,
    clientId: decision.clientId,
    subjectUserId: decision.subjectUserId,
    results: decision.results,
    decidedAt: decision.decidedAt,
  });
}

/** Mais recente primeiro; o id desempata (mesma ordem do uuid no Postgres). */
function compareNewestFirst(
  a: AuthorizationDecision,
  b: AuthorizationDecision,
): number {
  const byDate = b.decidedAt.getTime() - a.decidedAt.getTime();
  if (byDate !== 0) return byDate;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

function isAfter(
  decision: AuthorizationDecision,
  cursor: AuthorizationDecisionCursor,
): boolean {
  const byDate = decision.decidedAt.getTime() - cursor.decidedAt.getTime();
  return byDate < 0 || (byDate === 0 && decision.id < cursor.id);
}

function matches(
  decision: AuthorizationDecision,
  filter: AuthorizationDecisionFilter,
): boolean {
  const time = decision.decidedAt.getTime();
  return (
    (!filter.subjectUserId ||
      decision.subjectUserId === filter.subjectUserId) &&
    (filter.clientId === undefined || decision.clientId === filter.clientId) &&
    (filter.allowed === undefined || decision.allowed === filter.allowed) &&
    (!filter.permission ||
      decision.results.some((r) => r.permission === filter.permission)) &&
    (!filter.decidedFrom || time >= filter.decidedFrom.getTime()) &&
    (!filter.decidedTo || time <= filter.decidedTo.getTime())
  );
}

/** Só grava e lista, como a tabela; guarda cópias. */
export class InMemoryAuthorizationDecisionLog extends AuthorizationDecisionLog {
  private readonly rows: RecordedAuthorizationDecision[] = [];
  private failure: Error | null = null;

  /** Sem contexto, como fora de uma requisição: requestId null. */
  constructor(private readonly requestContext?: RequestContextPort) {
    super();
  }

  get items(): AuthorizationDecision[] {
    return this.rows.map(({ decision }) => copy(decision));
  }

  /** A próxima gravação (e as seguintes) lança este erro. */
  failWith(error: Error): void {
    this.failure = error;
  }

  async record(decision: AuthorizationDecision): Promise<void> {
    if (this.failure) throw this.failure;
    this.rows.push({
      decision: copy(decision),
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
      after?: AuthorizationDecisionCursor;
      filter?: AuthorizationDecisionFilter;
    },
  ): Promise<AuthorizationDecisionPage> {
    const found = this.rows
      .map(({ decision, requestId }) => ({
        decision: copy(decision),
        requestId,
      }))
      .filter(({ decision }) => decision.organizationId === organizationId)
      .filter(({ decision }) => matches(decision, filter))
      .filter(({ decision }) => !after || isAfter(decision, after))
      .sort((a, b) => compareNewestFirst(a.decision, b.decision));

    return {
      items: found.slice(0, first),
      hasNextPage: found.length > first,
    };
  }
}
