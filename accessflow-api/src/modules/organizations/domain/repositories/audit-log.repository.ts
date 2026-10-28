import {
  AuditAction,
  AuditEvent,
  AuditTargetType,
} from '../entities/audit-event.entity';

export interface AuditEventCursor {
  occurredAt: Date;
  id: string;
}

/** Critérios combinados com E; ausente não filtra. As datas são inclusivas. */
export interface AuditEventFilter {
  actions?: AuditAction[];
  actorUserId?: string;
  targetType?: AuditTargetType;
  targetId?: string;
  occurredFrom?: Date;
  occurredTo?: Date;
}

export interface AuditEventPage {
  items: AuditEvent[];
  hasNextPage: boolean;
}

/** Trilha de auditoria: só grava e lista. Não há como alterar nem apagar. */
export abstract class AuditLog {
  /**
   * Grava o evento. Chamar dentro do TransactionManager.run da ação, depois
   * da escrita principal: se a gravação falhar, a ação é desfeita, e
   * vice-versa.
   */
  abstract record(event: AuditEvent): Promise<void>;

  /**
   * Eventos da organização, do mais recente para o mais antigo (`occurredAt`
   * e `id` descendentes). Com `after`, começa logo depois dessa posição.
   */
  abstract listByOrganization(
    organizationId: string,
    options: {
      first: number;
      after?: AuditEventCursor;
      filter?: AuditEventFilter;
    },
  ): Promise<AuditEventPage>;
}
