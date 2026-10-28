import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { PrismaTransactionManager } from '@/shared/infrastructure/database/prisma-transaction-manager';
import {
  AuditAction,
  AuditActorType,
  AuditEvent,
} from '@/modules/organizations/domain/entities/audit-event.entity';
import { PrismaAuditLogRepository } from '@/modules/organizations/infrastructure/persistence/prisma-audit-log.repository';
import { AsyncLocalRequestContext } from '@/shared/infrastructure/request-context/async-local-request-context';
import {
  SeededOrganization,
  seedOrganization,
} from '@test/factory/organizations/seed-organization';

// Fora de requisição: o request_id dos eventos fica nulo.
const requestContext = new AsyncLocalRequestContext();

const T0 = new Date('2026-03-01T12:00:00.000Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

let prisma: PrismaService;
let transactions: PrismaTransactionManager;
let audit: PrismaAuditLogRepository;

async function createUser(cognitoSub: string) {
  return prisma.user.create({
    data: { cognitoSub, name: 'Usuário', email: `${cognitoSub}@example.com` },
  });
}

describe('PrismaAuditLogRepository (integração)', () => {
  let acme: SeededOrganization;
  let beta: SeededOrganization;
  let ana: { id: string };
  let bruno: { id: string };

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const clients = new PrismaClientProvider(prisma);
    transactions = new PrismaTransactionManager(prisma, clients);
    audit = new PrismaAuditLogRepository(clients, requestContext);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // A mesma limpeza dos outros testes: o CASCADE alcança audit_events.
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "memberships", "organizations", "users" CASCADE`;
    ana = await createUser('sub-ana');
    bruno = await createUser('sub-bruno');
    acme = await seedOrganization(prisma, { slug: 'acme', owner: ana.id });
    beta = await seedOrganization(prisma, { slug: 'beta', owner: ana.id });
  });

  function roleCreated(
    occurredAt: Date,
    options: {
      organizationId?: string;
      actorId?: string;
      roleId?: string;
    } = {},
  ) {
    return AuditEvent.create(
      {
        organizationId: options.organizationId ?? acme.id,
        actor: { type: AuditActorType.USER, userId: options.actorId ?? ana.id },
        action: AuditAction.ROLE_CREATED,
        targetId: options.roleId ?? crypto.randomUUID(),
        details: { name: 'Financeiro', permissions: ['members:read'] },
      },
      occurredAt,
    );
  }

  async function listAll(
    filter: Parameters<typeof audit.listByOrganization>[1]['filter'] = {},
    organizationId = acme.id,
  ) {
    const { items } = await audit.listByOrganization(organizationId, {
      first: 50,
      filter,
    });
    return items.map(({ event }) => event);
  }

  it('record grava e a leitura devolve o mesmo evento, com o details jsonb intacto', async () => {
    const event = AuditEvent.create(
      {
        organizationId: acme.id,
        actor: { type: AuditActorType.USER, userId: ana.id },
        action: AuditAction.ROLE_UPDATED,
        targetId: acme.roleIds.MEMBER,
        details: {
          changes: {
            name: { from: 'Gerência', to: 'Diretoria 🚀' },
            permissionsAdded: ['invoices:approve'],
          },
        },
      },
      T0,
    );

    await audit.record(event);

    expect(await listAll()).toEqual([event]);
    expect(
      await prisma.auditEvent.findUniqueOrThrow({ where: { id: event.id } }),
    ).toMatchObject({
      actorType: 'USER',
      actorUserId: ana.id,
      actorClientId: null,
      action: 'role.updated',
      targetType: 'role',
      targetId: acme.roleIds.MEMBER,
      occurredAt: T0,
      requestId: null,
    });
  });

  it('grava o id de correlação da requisição em andamento (também dentro da transação) e a leitura o devolve', async () => {
    const [direct, inTransaction] = [roleCreated(at(0)), roleCreated(at(1))];

    await requestContext.run({ requestId: 'req-direto-0001' }, () =>
      audit.record(direct),
    );
    await requestContext.run({ requestId: 'req-transacao-0002' }, () =>
      transactions.run(() => audit.record(inTransaction)),
    );

    const { items } = await audit.listByOrganization(acme.id, { first: 10 });
    expect(items.map(({ event, requestId }) => [event.id, requestId])).toEqual([
      [inTransaction.id, 'req-transacao-0002'],
      [direct.id, 'req-direto-0001'],
    ]);
  });

  it('pagina do mais recente para o mais antigo, estável com occurredAt empatado', async () => {
    const tied = Array.from({ length: 5 }, () => roleCreated(at(10)));
    const events = [roleCreated(at(0)), ...tied, roleCreated(at(20))];
    for (const event of events) await audit.record(event);

    const seen: AuditEvent[] = [];
    let after: { occurredAt: Date; id: string } | undefined;
    let pages = 0;
    for (;;) {
      const page = await audit.listByOrganization(acme.id, { first: 2, after });
      seen.push(...page.items.map(({ event }) => event));
      pages++;
      if (!page.hasNextPage) break;
      const last = page.items[page.items.length - 1].event;
      after = { occurredAt: last.occurredAt, id: last.id };
    }

    const expected = [...events].sort(
      (a, b) =>
        b.occurredAt.getTime() - a.occurredAt.getTime() ||
        (a.id < b.id ? 1 : -1),
    );
    expect(seen.map((e) => e.id)).toEqual(expected.map((e) => e.id));
    expect(new Set(seen.map((e) => e.id)).size).toBe(7);
    expect(pages).toBe(4);
  });

  describe('filtros', () => {
    let first: AuditEvent;
    let byBruno: AuditEvent;
    let renamed: AuditEvent;
    let last: AuditEvent;

    beforeEach(async () => {
      first = roleCreated(at(0));
      byBruno = roleCreated(at(10), { actorId: bruno.id });
      renamed = AuditEvent.create(
        {
          organizationId: acme.id,
          actor: { type: AuditActorType.USER, userId: ana.id },
          action: AuditAction.ORGANIZATION_UPDATED,
          targetId: acme.id,
          details: { changes: { name: { from: 'Acme', to: 'Acme SA' } } },
        },
        at(20),
      );
      last = roleCreated(at(30), { roleId: first.target.id });
      const otherOrganization = roleCreated(at(15), {
        organizationId: beta.id,
      });
      for (const event of [first, byBruno, renamed, last, otherOrganization]) {
        await audit.record(event);
      }
    });

    const ids = (events: AuditEvent[]) => events.map((e) => e.id);

    it('sem filtro: só a organização pedida', async () => {
      expect(ids(await listAll())).toEqual(
        ids([last, renamed, byBruno, first]),
      );
    });

    it('actions, actorUserId, alvo e período (inclusivo), combinados com E', async () => {
      expect(
        ids(await listAll({ actions: [AuditAction.ORGANIZATION_UPDATED] })),
      ).toEqual(ids([renamed]));
      expect(ids(await listAll({ actorUserId: bruno.id }))).toEqual(
        ids([byBruno]),
      );
      expect(
        ids(await listAll({ targetType: 'role', targetId: first.target.id })),
      ).toEqual(ids([last, first]));
      expect(
        ids(await listAll({ occurredFrom: at(10), occurredTo: at(20) })),
      ).toEqual(ids([renamed, byBruno]));
      expect(
        ids(
          await listAll({
            actions: [AuditAction.ROLE_CREATED],
            actorUserId: ana.id,
            occurredTo: at(29),
          }),
        ),
      ).toEqual(ids([first]));
    });
  });

  describe('só acréscimos', () => {
    let event: AuditEvent;

    beforeEach(async () => {
      event = roleCreated(T0);
      await audit.record(event);
    });

    it('UPDATE é recusado pelo trigger e a linha não muda', async () => {
      for (const attempt of [
        () =>
          prisma.auditEvent.update({
            where: { id: event.id },
            data: { action: 'role.deleted' },
          }),
        () => prisma.$executeRaw`UPDATE audit_events SET target_id = 'x'`,
      ]) {
        await expect(attempt()).rejects.toThrow(
          /audit_events só aceita INSERT: UPDATE recusado/,
        );
      }
      expect(
        (await prisma.auditEvent.findUniqueOrThrow({ where: { id: event.id } }))
          .action,
      ).toBe('role.created');
    });

    it('DELETE é recusado pelo trigger e a linha fica', async () => {
      for (const attempt of [
        () => prisma.auditEvent.delete({ where: { id: event.id } }),
        () => prisma.auditEvent.deleteMany({}),
      ]) {
        await expect(attempt()).rejects.toThrow(
          /audit_events só aceita INSERT: DELETE recusado/,
        );
      }
      expect(await prisma.auditEvent.count()).toBe(1);
    });

    it('TRUNCATE não dispara o trigger de linha: a limpeza dos testes funciona', async () => {
      await prisma.$executeRaw`TRUNCATE TABLE "invitations", "memberships", "organizations", "users" CASCADE`;

      expect(await prisma.auditEvent.count()).toBe(0);
    });
  });

  describe('restrições do banco', () => {
    function insert(columns: {
      actorType: string;
      actorUserId: string | null;
      actorClientId: string | null;
      details?: string;
    }) {
      return prisma.$executeRaw`
        INSERT INTO audit_events
          (id, organization_id, actor_type, actor_user_id, actor_client_id,
           action, target_type, target_id, details, occurred_at)
        VALUES
          (gen_random_uuid(), ${acme.id}::uuid, ${columns.actorType}::"AuditActorType",
           ${columns.actorUserId}::uuid, ${columns.actorClientId},
           'role.deleted', 'role', 'role-1', ${columns.details ?? '{}'}::jsonb, now())`;
    }

    it.each([
      [
        'USER sem actor_user_id',
        { actorType: 'USER', actorUserId: null, actorClientId: null },
      ],
      [
        'USER com actor_client_id',
        { actorType: 'USER', actorUserId: 'ANA', actorClientId: 'erp' },
      ],
      [
        'MACHINE sem actor_client_id',
        { actorType: 'MACHINE', actorUserId: null, actorClientId: null },
      ],
      [
        'MACHINE com actor_user_id',
        { actorType: 'MACHINE', actorUserId: 'ANA', actorClientId: 'erp' },
      ],
      [
        'SYSTEM com alguma coluna de ator',
        { actorType: 'SYSTEM', actorUserId: null, actorClientId: 'erp' },
      ],
    ])('CHECK do ator recusa %s', async (_, columns) => {
      const actorUserId = columns.actorUserId === 'ANA' ? ana.id : null;

      await expect(insert({ ...columns, actorUserId })).rejects.toThrow(
        /audit_events_actor_check/,
      );
    });

    it('CHECK do ator aceita os três tipos coerentes', async () => {
      await insert({
        actorType: 'USER',
        actorUserId: ana.id,
        actorClientId: null,
      });
      await insert({
        actorType: 'MACHINE',
        actorUserId: null,
        actorClientId: 'erp',
      });
      await insert({
        actorType: 'SYSTEM',
        actorUserId: null,
        actorClientId: null,
      });

      expect(await prisma.auditEvent.count()).toBe(3);
    });

    it('CHECK do details recusa o que não é objeto', async () => {
      for (const details of ['[]', '"texto"', '42', 'null']) {
        await expect(
          insert({
            actorType: 'SYSTEM',
            actorUserId: null,
            actorClientId: null,
            details,
          }),
        ).rejects.toThrow(/audit_events_details_check/);
      }
    });

    it('FK: organização e usuário ator precisam existir', async () => {
      for (const event of [
        roleCreated(T0, { organizationId: crypto.randomUUID() }),
        roleCreated(T0, { actorId: crypto.randomUUID() }),
      ]) {
        const error = await audit.record(event).catch((e: unknown) => e);

        expect(
          error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2003',
        ).toBe(true);
      }
    });
  });

  it('dentro de uma transação desfeita, o evento também some', async () => {
    await expect(
      transactions.run(async () => {
        await audit.record(roleCreated(T0));
        throw new Error('a ação falhou depois do evento');
      }),
    ).rejects.toThrow('a ação falhou depois do evento');

    expect(await prisma.auditEvent.count()).toBe(0);
  });
});
