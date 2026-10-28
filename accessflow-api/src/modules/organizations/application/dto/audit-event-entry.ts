import { AuditEvent } from '../../domain/entities/audit-event.entity';

export interface AuditEventEntry {
  event: AuditEvent;
  /** Nome do usuário ator; null para outros atores ou perfil não encontrado. */
  actorName: string | null;
}

export interface AuditEventsPage {
  items: AuditEventEntry[];
  hasNextPage: boolean;
}
