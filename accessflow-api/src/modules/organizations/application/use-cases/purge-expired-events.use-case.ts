import { EventRetention } from '../../domain/repositories/event-retention.repository';

/** Linhas por lote: cada lote é uma transação curta. */
export const PURGE_BATCH_SIZE = 5000;

export interface PurgedTable {
  deleted: number;
  /** Lotes que apagaram alguma linha. */
  batches: number;
  retentionDays: number;
}

export interface PurgeResult {
  authorizationDecisions: PurgedTable;
  securityEvents: PurgedTable;
}

/**
 * Apaga, em lotes, as decisões do authorize e os eventos de segurança fora
 * da retenção. Idempotente: sem nada vencido, não apaga nada.
 */
export class PurgeExpiredEventsUseCase {
  constructor(
    private readonly retention: EventRetention,
    private readonly batchSize = PURGE_BATCH_SIZE,
  ) {}

  async execute(): Promise<PurgeResult> {
    const days = await this.retention.retentionDays();

    const decisions = await this.drain((limit) =>
      this.retention.deleteExpiredAuthorizationDecisions(limit),
    );
    const events = await this.drain((limit) =>
      this.retention.deleteExpiredSecurityEvents(limit),
    );

    return {
      authorizationDecisions: {
        ...decisions,
        retentionDays: days.authorizationDecisions,
      },
      securityEvents: { ...events, retentionDays: days.securityEvents },
    };
  }

  /**
   * Lote atrás de lote até um vir incompleto: aí não sobrou nada vencido. O
   * que vencer durante o expurgo fica para a próxima execução.
   */
  private async drain(
    deleteBatch: (limit: number) => Promise<number>,
  ): Promise<{ deleted: number; batches: number }> {
    let deleted = 0;
    let batches = 0;
    for (;;) {
      const count = await deleteBatch(this.batchSize);
      if (count > 0) {
        deleted += count;
        batches++;
      }
      if (count < this.batchSize) return { deleted, batches };
    }
  }
}
