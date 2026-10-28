import {
  SecurityEvent,
  SecurityEventType,
} from '../entities/security-event.entity';

export interface SecurityEventCursor {
  occurredAt: Date;
  id: string;
}

/** Critérios combinados com E; ausente não filtra. As datas são inclusivas. */
export interface SecurityEventFilter {
  /** Qualquer um destes eventos. */
  events?: SecurityEventType[];
  actorUserId?: string;
  actorClientId?: string;
  occurredFrom?: Date;
  occurredTo?: Date;
}

/** O evento como foi gravado, com o id de correlação da requisição. */
export interface RecordedSecurityEvent {
  event: SecurityEvent;
  /** X-Request-Id da requisição negada; null fora de uma. */
  requestId: string | null;
}

export interface SecurityEventPage {
  items: RecordedSecurityEvent[];
  hasNextPage: boolean;
}

/** Eventos de segurança: só grava e lista. */
export abstract class SecurityEventLog {
  /**
   * Grava o evento numa escrita própria, nunca na transação ativa: a
   * negação desfaz a transação da ação, e o evento tem de ficar. O id de
   * correlação vem da requisição em andamento.
   */
  abstract record(event: SecurityEvent): Promise<void>;

  /**
   * Eventos da organização, do mais recente para o mais antigo (`occurredAt`
   * e `id` descendentes). Com `after`, começa logo depois dessa posição.
   */
  abstract listByOrganization(
    organizationId: string,
    options: {
      first: number;
      after?: SecurityEventCursor;
      filter?: SecurityEventFilter;
    },
  ): Promise<SecurityEventPage>;
}
