import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { PrismaTransactionManager } from '@/shared/infrastructure/database/prisma-transaction-manager';
import { AsyncLocalRequestContext } from '@/shared/infrastructure/request-context/async-local-request-context';
import {
  SecurityActor,
  SecurityEvent,
} from '@/modules/organizations/domain/entities/security-event.entity';
import { PrismaSecurityEventLog } from '@/modules/organizations/infrastructure/persistence/prisma-security-event-log';
import {
  SeededOrganization,
  seedOrganization,
} from '@test/factory/organizations/seed-organization';

const T0 = new Date('2026-03-01T12:00:00.000Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

const ANA = '44444444-4444-4444-8444-444444444444';
const BRUNO = '55555555-5555-4555-8555-555555555555';
const ROUTE = 'GET /v1/organizations/:organizationId/members/:userId';

const requestContext = new AsyncLocalRequestContext();

let prisma: PrismaService;
let clients: PrismaClientProvider;
let log: PrismaSecurityEventLog;

const user = (userId: string): SecurityActor => ({ type: 'USER', userId });
const machine = (clientId: string): SecurityActor => ({
  type: 'MACHINE',
  clientId,
});

describe('PrismaSecurityEventLog (integração)', () => {
  let acme: SeededOrganization;
  let beta: SeededOrganization;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    clients = new PrismaClientProvider(prisma);
    log = new PrismaSecurityEventLog(prisma, requestContext);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Sem FK, o CASCADE das organizações não alcança security_events.
    await prisma.$executeRaw`TRUNCATE TABLE "security_events", "invitations", "memberships", "organizations", "users" CASCADE`;
    acme = await seedOrganization(prisma, { slug: 'acme' });
    beta = await seedOrganization(prisma, { slug: 'beta' });
  });

  function forbidden(
    occurredAt: Date,
    options: { organizationId?: string; userId?: string } = {},
  ) {
    return SecurityEvent.create(
      {
        organizationId: options.organizationId ?? acme.id,
        actor: user(options.userId ?? ANA),
        event: 'access.forbidden',
        details: { operation: 'createRole', permission: 'roles:manage' },
      },
      occurredAt,
    );
  }

  function scopeDenied(
    occurredAt: Date,
    options: { organizationId?: string | null; clientId?: string } = {},
  ) {
    return SecurityEvent.create(
      {
        organizationId:
          options.organizationId === undefined
            ? acme.id
            : options.organizationId,
        actor: machine(options.clientId ?? 'client-acme'),
        event: 'machine.scope_denied',
        details: {
          route: ROUTE,
          requiredScopes: ['accessflow-api/members.read'],
        },
      },
      occurredAt,
    );
  }

  async function listAll(
    filter: Parameters<typeof log.listByOrganization>[1]['filter'] = {},
    organizationId = acme.id,
  ) {
    const { items } = await log.listByOrganization(organizationId, {
      first: 50,
      filter,
    });
    return items.map((item) => item.event.id);
  }

  it('grava numa linha só, com o requestId da requisição, e a leitura devolve o mesmo evento', async () => {
    const userEvent = forbidden(at(0));
    const machineEvent = scopeDenied(at(1));

    await requestContext.run({ requestId: 'req-seguranca-01' }, () =>
      log.record(userEvent),
    );
    await log.record(machineEvent);

    const { items } = await log.listByOrganization(acme.id, { first: 10 });
    expect(items).toEqual([
      { event: machineEvent, requestId: null },
      { event: userEvent, requestId: 'req-seguranca-01' },
    ]);
    expect(
      await prisma.securityEvent.findUniqueOrThrow({
        where: { id: userEvent.id },
      }),
    ).toEqual({
      id: userEvent.id,
      organizationId: acme.id,
      actorType: 'USER',
      actorUserId: ANA,
      actorClientId: null,
      event: 'access.forbidden',
      details: { operation: 'createRole', permission: 'roles:manage' },
      requestId: 'req-seguranca-01',
      occurredAt: at(0),
    });
  });

  it('evento sem organização é gravado, mas não aparece em nenhuma', async () => {
    const orphan = scopeDenied(at(0), {
      organizationId: null,
      clientId: 'client-desconhecido',
    });

    await log.record(orphan);

    expect(await prisma.securityEvent.count()).toBe(1);
    expect(await listAll()).toEqual([]);
    expect(await listAll({}, beta.id)).toEqual([]);
  });

  it('pagina do mais recente para o mais antigo, estável com occurredAt empatado', async () => {
    const tied = Array.from({ length: 5 }, () => forbidden(at(10)));
    const all = [forbidden(at(0)), ...tied, forbidden(at(20))];
    for (const e of all) await log.record(e);

    const seen: string[] = [];
    let after: { occurredAt: Date; id: string } | undefined;
    let pages = 0;
    for (;;) {
      const page = await log.listByOrganization(acme.id, { first: 2, after });
      seen.push(...page.items.map((i) => i.event.id));
      pages++;
      if (!page.hasNextPage) break;
      const last = page.items[page.items.length - 1].event;
      after = { occurredAt: last.occurredAt, id: last.id };
    }

    const expected = [...all].sort(
      (a, b) =>
        b.occurredAt.getTime() - a.occurredAt.getTime() ||
        (a.id < b.id ? 1 : -1),
    );
    expect(seen).toEqual(expected.map((e) => e.id));
    expect(pages).toBe(4);
  });

  it('filtros, sozinhos e combinados com E; só a organização pedida', async () => {
    const anaOld = forbidden(at(0));
    const brunoMid = forbidden(at(10), { userId: BRUNO });
    const erp = scopeDenied(at(20), { clientId: 'client-erp' });
    const anaNew = forbidden(at(30));
    for (const e of [anaOld, brunoMid, erp, anaNew]) await log.record(e);
    await log.record(forbidden(at(15), { organizationId: beta.id }));

    expect(await listAll()).toEqual([
      anaNew.id,
      erp.id,
      brunoMid.id,
      anaOld.id,
    ]);
    expect(await listAll({ events: ['machine.scope_denied'] })).toEqual([
      erp.id,
    ]);
    expect(
      await listAll({
        events: ['access.forbidden', 'machine.organization_denied'],
      }),
    ).toEqual([anaNew.id, brunoMid.id, anaOld.id]);
    expect(await listAll({ actorUserId: BRUNO })).toEqual([brunoMid.id]);
    expect(await listAll({ actorClientId: 'client-erp' })).toEqual([erp.id]);
    expect(await listAll({ occurredFrom: at(10), occurredTo: at(20) })).toEqual(
      [erp.id, brunoMid.id],
    );
    expect(await listAll({ actorUserId: ANA, occurredFrom: at(5) })).toEqual([
      anaNew.id,
    ]);
  });

  describe('restrições do banco', () => {
    function insert(actor: string, details = '{}') {
      return prisma.$executeRawUnsafe(`
        INSERT INTO security_events
          (id, organization_id, actor_type, actor_user_id, actor_client_id, event, details, occurred_at)
        VALUES (gen_random_uuid(), NULL, ${actor}, 'machine.scope_denied', '${details}'::jsonb, now())`);
    }

    it.each([
      ['USER sem usuário', `'USER', NULL, NULL`],
      ['USER com client', `'USER', '${ANA}', 'client-acme'`],
      ['MACHINE sem client', `'MACHINE', NULL, NULL`],
      ['MACHINE com usuário', `'MACHINE', '${ANA}', 'client-acme'`],
    ])('CHECK do ator recusa %s', async (_, actor) => {
      await expect(insert(actor)).rejects.toThrow(
        /security_events_actor_check/,
      );
    });

    it.each([
      ['lista', '[]'],
      ['texto', '"x"'],
    ])('CHECK do details recusa %s', async (_, details) => {
      await expect(
        insert(`'MACHINE', NULL, 'client-acme'`, details),
      ).rejects.toThrow(/security_events_details_check/);
    });
  });

  it('dentro de uma transação que travou a organização: volta em menos de 1 s e fica mesmo com a transação desfeita', async () => {
    const transactions = new PrismaTransactionManager(prisma, clients);
    const event = forbidden(at(0));
    const denied = new Error('negado: a ação é desfeita');
    let elapsed = Number.NaN;

    // Como numa ação negada: a organização travada (FOR UPDATE) na própria
    // transação, que depois é desfeita. O registro vai por outra conexão e,
    // sem FK, não pede trava na linha da organização.
    const outcome = transactions
      .run(async () => {
        await clients.current()
          .$queryRaw`SELECT id FROM organizations WHERE id = ${acme.id}::uuid FOR UPDATE`;
        await clients.current()
          .$executeRaw`UPDATE organizations SET name = 'Desfeito' WHERE id = ${acme.id}::uuid`;

        const started = Date.now();
        await log.record(event);
        elapsed = Date.now() - started;

        throw denied;
      })
      .catch((e: unknown) => e);

    expect(await outcome).toBe(denied);
    expect(elapsed).toBeLessThan(1000);
    expect(await listAll()).toEqual([event.id]);
    expect(
      (await prisma.organization.findUniqueOrThrow({ where: { id: acme.id } }))
        .name,
    ).not.toBe('Desfeito');
  });
});
