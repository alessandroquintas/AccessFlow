import { AuthorizationDecision } from '../entities/authorization-decision.entity';

export interface AuthorizationDecisionCursor {
  decidedAt: Date;
  id: string;
}

/** Critérios combinados com E; ausente não filtra. As datas são inclusivas. */
export interface AuthorizationDecisionFilter {
  subjectUserId?: string;
  clientId?: string;
  allowed?: boolean;
  /** Decisões em que esta chave estava entre as pedidas. */
  permission?: string;
  decidedFrom?: Date;
  decidedTo?: Date;
}

/** A decisão como foi gravada, com o id de correlação da requisição. */
export interface RecordedAuthorizationDecision {
  decision: AuthorizationDecision;
  /** X-Request-Id da requisição do authorize; null fora de uma. */
  requestId: string | null;
}

export interface AuthorizationDecisionPage {
  items: RecordedAuthorizationDecision[];
  hasNextPage: boolean;
}

/** Log das decisões do authorize: só grava e lista. */
export abstract class AuthorizationDecisionLog {
  /**
   * Grava a decisão numa escrita só, com o id de correlação da requisição em
   * andamento. Se falhar, lança: a decisão não pode sair sem registro.
   */
  abstract record(decision: AuthorizationDecision): Promise<void>;

  /**
   * Decisões da organização, da mais recente para a mais antiga
   * (`decidedAt` e `id` descendentes). Com `after`, começa logo depois.
   */
  abstract listByOrganization(
    organizationId: string,
    options: {
      first: number;
      after?: AuthorizationDecisionCursor;
      filter?: AuthorizationDecisionFilter;
    },
  ): Promise<AuthorizationDecisionPage>;
}
