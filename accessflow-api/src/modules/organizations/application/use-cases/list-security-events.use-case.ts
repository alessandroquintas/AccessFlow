import { isUuid } from '@/shared/domain/uuid';
import {
  isSecurityEventType,
  SecurityActorType,
} from '../../domain/entities/security-event.entity';
import {
  SecurityEventCursor,
  SecurityEventFilter,
  SecurityEventLog,
} from '../../domain/repositories/security-event-log.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { SecurityEventsPage } from '../dto/security-event-entry';
import { InvalidAuditFilterError } from '../errors/invalid-audit-filter.error';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';

/** O filtro como chega de fora, ainda sem validar. */
export interface ListSecurityEventsFilterInput {
  events?: string[];
  actorUserId?: string;
  actorClientId?: string;
  occurredFrom?: Date;
  occurredTo?: Date;
}

export interface ListSecurityEventsInput {
  cognitoSub: string;
  organizationId: string;
  first: number;
  after?: SecurityEventCursor;
  filter?: ListSecurityEventsFilterInput;
}

export class ListSecurityEventsUseCase {
  constructor(
    private readonly securityEvents: SecurityEventLog,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
  ) {}

  /** Do mais recente para o mais antigo. Exige audit:read. */
  async execute(input: ListSecurityEventsInput): Promise<SecurityEventsPage> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);
    // Antes do acesso, como o cursor: o 400 não depende da organização.
    const filter = parseFilter(input.filter ?? {});
    const organizationId = input.organizationId.toLowerCase();

    await this.access.requirePermission(
      organizationId,
      userId,
      OrganizationPermission.AUDIT_READ,
    );

    const page = await this.securityEvents.listByOrganization(organizationId, {
      first: input.first,
      after: input.after,
      filter,
    });

    // Os nomes da página numa consulta só.
    const actorIds = page.items.flatMap(({ event: { actor } }) =>
      actor.type === SecurityActorType.USER ? [actor.userId] : [],
    );
    const profiles =
      actorIds.length > 0
        ? await this.users.getProfilesByIds([...new Set(actorIds)])
        : [];
    const nameById = new Map(profiles.map((p) => [p.id, p.name]));

    return {
      items: page.items.map(({ event, requestId }) => ({
        event,
        requestId,
        actorName:
          event.actor.type === SecurityActorType.USER
            ? (nameById.get(event.actor.userId) ?? null)
            : null,
      })),
      hasNextPage: page.hasNextPage,
    };
  }
}

/**
 * Valida e normaliza o filtro: evento fora do catálogo, ator que não é UUID,
 * client vazio e período invertido são INVALID_AUDIT_FILTER. Lista de
 * eventos vazia não filtra.
 */
function parseFilter(
  input: ListSecurityEventsFilterInput,
): SecurityEventFilter {
  const events = input.events ?? [];
  const unknown = events.filter((event) => !isSecurityEventType(event));
  if (unknown.length > 0) {
    throw new InvalidAuditFilterError(
      `Evento fora do catálogo: ${unknown.map((e) => JSON.stringify(e)).join(', ')}.`,
    );
  }

  const actorUserId = input.actorUserId?.toLowerCase();
  if (actorUserId !== undefined && !isUuid(actorUserId)) {
    throw new InvalidAuditFilterError('actorUserId deve ser um UUID.');
  }

  if (input.actorClientId !== undefined && !input.actorClientId.trim()) {
    throw new InvalidAuditFilterError('actorClientId não pode ser vazio.');
  }

  const { occurredFrom, occurredTo } = input;
  if (occurredFrom && occurredTo && occurredFrom > occurredTo) {
    throw new InvalidAuditFilterError(
      'occurredFrom não pode ser depois de occurredTo.',
    );
  }

  return {
    events: events.filter(isSecurityEventType),
    actorUserId,
    actorClientId: input.actorClientId,
    occurredFrom,
    occurredTo,
  };
}
