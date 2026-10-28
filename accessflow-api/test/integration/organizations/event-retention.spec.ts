import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplicationContext } from '@nestjs/common';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { EventRetentionModule } from '@/modules/organizations/event-retention.module';
import { EventRetention } from '@/modules/organizations/domain/repositories/event-retention.repository';
import { PurgeExpiredEventsUseCase } from '@/modules/organizations/application/use-cases/purge-expired-events.use-case';

/** Os prazos do documento da Fase 9b. */
const DECISION_DAYS = 90;
const EVENT_DAYS = 180;

let app: INestApplicationContext;
let prisma: PrismaService;
let retention: EventRetention;

/** Uma decisão de `age` atrás (intervalo do Postgres), pelo relógio do banco. */
async function decisionAged(age: string): Promise<string> {
  const [{ id }] = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO authorization_decisions
      (id, organization_id, client_id, subject_user_id, results, allowed, decided_at)
    VALUES (gen_random_uuid(), gen_random_uuid(), 'client-acme', gen_random_uuid(),
            '[{"permission": "a:b", "allowed": true}]', true, now() - ${age}::interval)
    RETURNING id`;
  return id;
}

/** Um evento de segurança de `age` atrás; sem organização se `orphan`. */
async function eventAged(age: string, orphan = false): Promise<string> {
  const [{ id }] = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO security_events
      (id, organization_id, actor_type, actor_client_id, event, details, occurred_at)
    VALUES (gen_random_uuid(), ${orphan ? null : crypto.randomUUID()}::uuid,
            'MACHINE', 'client-acme', 'machine.scope_denied',
            '{"route": "POST /v1/authorize", "requiredScopes": []}', now() - ${age}::interval)
    RETURNING id`;
  return id;
}

async function remaining(table: 'authorization_decisions' | 'security_events') {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM ${table}`,
  );
  return rows.map((r) => r.id).sort();
}

const TABLES = [
  {
    table: 'authorization_decisions' as const,
    days: DECISION_DAYS,
    aged: (age: string) => decisionAged(age),
    update: (id: string) =>
      prisma.$executeRaw`UPDATE authorization_decisions SET client_id = 'outro' WHERE id = ${id}::uuid`,
    remove: (id: string) =>
      prisma.$executeRaw`DELETE FROM authorization_decisions WHERE id = ${id}::uuid`,
  },
  {
    table: 'security_events' as const,
    days: EVENT_DAYS,
    aged: (age: string) => eventAged(age),
    update: (id: string) =>
      prisma.$executeRaw`UPDATE security_events SET actor_client_id = 'outro' WHERE id = ${id}::uuid`,
    remove: (id: string) =>
      prisma.$executeRaw`DELETE FROM security_events WHERE id = ${id}::uuid`,
  },
];

describe('Retenção das decisões e dos eventos de segurança (integração)', () => {
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventRetentionModule],
    }).compile();
    app = await moduleRef.init();
    prisma = app.get(PrismaService);
    retention = app.get(EventRetention);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // TRUNCATE não dispara os triggers de linha.
    await prisma.$executeRaw`TRUNCATE TABLE "authorization_decisions", "security_events"`;
  });

  it('os prazos em vigor, lidos da mesma função que o trigger usa: 90 e 180 dias', async () => {
    expect(await retention.retentionDays()).toEqual({
      authorizationDecisions: DECISION_DAYS,
      securityEvents: EVENT_DAYS,
    });
  });

  describe.each(TABLES)('$table', ({ table, days, aged, update, remove }) => {
    it('UPDATE é sempre recusado, dentro ou fora do prazo', async () => {
      for (const id of [
        await aged('1 minute'),
        await aged(`${days + 1} days`),
      ]) {
        await expect(update(id)).rejects.toThrow(`${table} não aceita UPDATE`);
      }
    });

    it(`DELETE recusado dentro dos ${days} dias e aceito depois deles`, async () => {
      const inside = await aged(`${days} days - 1 minute`);
      const outside = await aged(`${days} days 1 minute`);

      await expect(remove(inside)).rejects.toThrow(
        `ainda dentro da retenção de ${days} days`,
      );
      expect(await remove(outside)).toBe(1);
      expect(await remaining(table)).toEqual([inside]);
    });
  });

  describe('expurgo', () => {
    let keptDecisions: string[];
    let keptEvents: string[];

    beforeEach(async () => {
      // 7 decisões vencidas (91 a 97 dias) e 2 no prazo; 4 eventos
      // vencidos (um sem organização) e 2 no prazo.
      for (let day = 91; day <= 97; day++) await decisionAged(`${day} days`);
      keptDecisions = [
        await decisionAged(`${DECISION_DAYS} days - 1 minute`),
        await decisionAged('1 hour'),
      ].sort();
      for (const day of [181, 182, 183]) await eventAged(`${day} days`);
      await eventAged('200 days', true);
      keptEvents = [
        await eventAged(`${EVENT_DAYS} days - 1 minute`),
        await eventAged('1 hour', true),
      ].sort();
    });

    it('apaga só o vencido, em lotes, e imprime as contagens', async () => {
      const result = await new PurgeExpiredEventsUseCase(
        retention,
        3,
      ).execute();

      expect(result).toEqual({
        authorizationDecisions: {
          deleted: 7,
          batches: 3,
          retentionDays: DECISION_DAYS,
        },
        securityEvents: { deleted: 4, batches: 2, retentionDays: EVENT_DAYS },
      });
      expect(await remaining('authorization_decisions')).toEqual(keptDecisions);
      expect(await remaining('security_events')).toEqual(keptEvents);
    });

    it('cada lote leva as mais antigas', async () => {
      expect(await retention.deleteExpiredAuthorizationDecisions(3)).toBe(3);

      const ages = await prisma.$queryRaw<{ days: number }[]>`
        SELECT extract(day FROM now() - decided_at)::int AS days
        FROM authorization_decisions ORDER BY decided_at`;
      // Saíram 97, 96 e 95 dias.
      expect(ages.map((a) => a.days)).toEqual([94, 93, 92, 91, 89, 0]);
    });

    it('idempotente: a segunda execução não apaga nada', async () => {
      const purge = app.get(PurgeExpiredEventsUseCase);

      const first = await purge.execute();
      const second = await purge.execute();

      expect(first.authorizationDecisions.deleted).toBe(7);
      expect(first.securityEvents.deleted).toBe(4);
      expect(second).toEqual({
        authorizationDecisions: {
          deleted: 0,
          batches: 0,
          retentionDays: DECISION_DAYS,
        },
        securityEvents: { deleted: 0, batches: 0, retentionDays: EVENT_DAYS },
      });
      expect(await remaining('authorization_decisions')).toEqual(keptDecisions);
      expect(await remaining('security_events')).toEqual(keptEvents);
    });
  });
});
