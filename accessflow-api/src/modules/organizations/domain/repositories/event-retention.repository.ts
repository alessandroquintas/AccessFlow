/** Prazo de cada tabela, em dias, como o banco o aplica. */
export interface RetentionDays {
  authorizationDecisions: number;
  securityEvents: number;
}

/**
 * Expurgo das decisões do authorize e dos eventos de segurança vencidos. O
 * prazo é o do banco: o mesmo que o trigger usa para recusar o DELETE de
 * linha ainda dentro da retenção. A trilha de auditoria não tem expurgo.
 */
export abstract class EventRetention {
  /** Os prazos em vigor. */
  abstract retentionDays(): Promise<RetentionDays>;

  /**
   * Apaga até `limit` decisões vencidas, das mais antigas, numa transação
   * própria e curta. Devolve quantas apagou.
   */
  abstract deleteExpiredAuthorizationDecisions(limit: number): Promise<number>;

  /** Como `deleteExpiredAuthorizationDecisions`, para os eventos de segurança. */
  abstract deleteExpiredSecurityEvents(limit: number): Promise<number>;
}
