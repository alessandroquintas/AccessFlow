import { SecurityEvent } from '../../domain/entities/security-event.entity';

export interface SecurityEventEntry {
  event: SecurityEvent;
  /** Nome do usuário ator; null para client ou perfil não encontrado. */
  actorName: string | null;
  requestId: string | null;
}

export interface SecurityEventsPage {
  items: SecurityEventEntry[];
  hasNextPage: boolean;
}
