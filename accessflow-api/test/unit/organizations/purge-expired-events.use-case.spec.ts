import { describe, expect, it } from 'vitest';
import {
  EventRetention,
  RetentionDays,
} from '@/modules/organizations/domain/repositories/event-retention.repository';
import {
  PURGE_BATCH_SIZE,
  PurgeExpiredEventsUseCase,
} from '@/modules/organizations/application/use-cases/purge-expired-events.use-case';
import { formatPurgeResult } from '@/modules/organizations/presentation/cli/purge-result.output';

/** Quantas linhas vencidas cada tabela tem; cada lote apaga até o limite. */
class FakeEventRetention extends EventRetention {
  limits: number[] = [];

  constructor(
    private expired: { decisions: number; events: number },
    private readonly days: RetentionDays = {
      authorizationDecisions: 90,
      securityEvents: 180,
    },
  ) {
    super();
  }

  async retentionDays(): Promise<RetentionDays> {
    return this.days;
  }

  async deleteExpiredAuthorizationDecisions(limit: number): Promise<number> {
    this.limits.push(limit);
    const count = Math.min(limit, this.expired.decisions);
    this.expired.decisions -= count;
    return count;
  }

  async deleteExpiredSecurityEvents(limit: number): Promise<number> {
    this.limits.push(limit);
    const count = Math.min(limit, this.expired.events);
    this.expired.events -= count;
    return count;
  }
}

describe('PurgeExpiredEventsUseCase', () => {
  it('lotes de 5 000 por padrão', async () => {
    const retention = new FakeEventRetention({ decisions: 0, events: 0 });

    await new PurgeExpiredEventsUseCase(retention).execute();

    expect(PURGE_BATCH_SIZE).toBe(5000);
    expect(retention.limits).toEqual([5000, 5000]);
  });

  it('apaga lote atrás de lote até um vir incompleto, e conta só os lotes que apagaram', async () => {
    const retention = new FakeEventRetention({ decisions: 7, events: 6 });

    const result = await new PurgeExpiredEventsUseCase(retention, 3).execute();

    expect(result).toEqual({
      authorizationDecisions: { deleted: 7, batches: 3, retentionDays: 90 },
      securityEvents: { deleted: 6, batches: 2, retentionDays: 180 },
    });
    // Decisões: 3, 3, 1. Eventos: 3, 3 e um lote vazio que encerra.
    expect(retention.limits).toHaveLength(6);
  });

  it('sem nada vencido: um lote vazio por tabela, nada apagado', async () => {
    const retention = new FakeEventRetention({ decisions: 0, events: 0 });

    const result = await new PurgeExpiredEventsUseCase(retention, 3).execute();

    expect(result.authorizationDecisions).toMatchObject({
      deleted: 0,
      batches: 0,
    });
    expect(result.securityEvents).toMatchObject({ deleted: 0, batches: 0 });
  });

  it('a saída do comando: só contagens e prazos', () => {
    expect(
      formatPurgeResult({
        authorizationDecisions: { deleted: 7, batches: 3, retentionDays: 90 },
        securityEvents: { deleted: 0, batches: 0, retentionDays: 180 },
      }),
    ).toEqual([
      'authorization_decisions: 7 apagada(s) em 3 lote(s); retenção de 90 dias.',
      'security_events: 0 apagada(s) em 0 lote(s); retenção de 180 dias.',
    ]);
  });
});
