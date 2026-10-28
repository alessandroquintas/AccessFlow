import { isUuid } from '@/shared/domain/uuid';
import {
  AuditActorType,
  isAuditAction,
  isAuditTargetType,
} from '../../domain/entities/audit-event.entity';
import {
  AuditEventCursor,
  AuditEventFilter,
  AuditLog,
} from '../../domain/repositories/audit-log.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { AuditEventsPage } from '../dto/audit-event-entry';
import { InvalidAuditFilterError } from '../errors/invalid-audit-filter.error';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';

/** O filtro como chega de fora, ainda sem validar. */
export interface ListAuditEventsFilterInput {
  actions?: string[];
  actorUserId?: string;
  targetType?: string;
  targetId?: string;
  occurredFrom?: Date;
  occurredTo?: Date;
}

export interface ListAuditEventsInput {
  cognitoSub: string;
  organizationId: string;
  first: number;
  after?: AuditEventCursor;
  filter?: ListAuditEventsFilterInput;
}

export class ListAuditEventsUseCase {
  constructor(
    private readonly audit: AuditLog,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
  ) {}

  /** Do mais recente para o mais antigo. Exige audit:read. */
  async execute(input: ListAuditEventsInput): Promise<AuditEventsPage> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);
    // Antes do acesso, como o cursor: o 400 não depende da organização.
    const filter = parseFilter(input.filter ?? {});
    const organizationId = input.organizationId.toLowerCase();

    await this.access.requirePermission(
      organizationId,
      userId,
      OrganizationPermission.AUDIT_READ,
    );

    const page = await this.audit.listByOrganization(organizationId, {
      first: input.first,
      after: input.after,
      filter,
    });

    // Os nomes da página numa consulta só.
    const actorIds = page.items.flatMap(({ actor }) =>
      actor.type === AuditActorType.USER ? [actor.userId] : [],
    );
    const profiles =
      actorIds.length > 0
        ? await this.users.getProfilesByIds([...new Set(actorIds)])
        : [];
    const nameById = new Map(profiles.map((p) => [p.id, p.name]));

    return {
      items: page.items.map((event) => ({
        event,
        actorName:
          event.actor.type === AuditActorType.USER
            ? (nameById.get(event.actor.userId) ?? null)
            : null,
      })),
      hasNextPage: page.hasNextPage,
    };
  }
}

/**
 * Valida e normaliza o filtro: ação ou tipo de alvo fora do catálogo, ator
 * que não é UUID e período invertido são INVALID_AUDIT_FILTER. Lista de
 * ações vazia não filtra.
 */
function parseFilter(input: ListAuditEventsFilterInput): AuditEventFilter {
  const actions = input.actions ?? [];
  const unknown = actions.filter((action) => !isAuditAction(action));
  if (unknown.length > 0) {
    throw new InvalidAuditFilterError(
      `Ação fora do catálogo: ${unknown.map((a) => JSON.stringify(a)).join(', ')}.`,
    );
  }

  if (input.targetType !== undefined && !isAuditTargetType(input.targetType)) {
    throw new InvalidAuditFilterError(
      `Tipo de alvo fora do catálogo: ${JSON.stringify(input.targetType)}.`,
    );
  }

  const actorUserId = input.actorUserId?.toLowerCase();
  if (actorUserId !== undefined && !isUuid(actorUserId)) {
    throw new InvalidAuditFilterError('actorUserId deve ser um UUID.');
  }

  const { occurredFrom, occurredTo } = input;
  if (occurredFrom && occurredTo && occurredFrom > occurredTo) {
    throw new InvalidAuditFilterError(
      'occurredFrom não pode ser depois de occurredTo.',
    );
  }

  return {
    actions: actions.filter(isAuditAction),
    actorUserId,
    targetType: input.targetType,
    targetId: input.targetId?.toLowerCase(),
    occurredFrom,
    occurredTo,
  };
}
