import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { AuthorizationDecision } from '@/modules/organizations/domain/entities/authorization-decision.entity';
import { PermissionDecision } from '@/modules/organizations/policies/authorization';
import { PrismaAuthorizationDecisionLog } from '@/modules/organizations/infrastructure/persistence/prisma-authorization-decision-log';
import { AsyncLocalRequestContext } from '@/shared/infrastructure/request-context/async-local-request-context';
import {
  SeededOrganization,
  seedOrganization,
} from '@test/factory/organizations/seed-organization';

const T0 = new Date('2026-03-01T12:00:00.000Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

const SUBJECT = '44444444-4444-4444-8444-444444444444';
const OTHER_SUBJECT = '55555555-5555-4555-8555-555555555555';
const APPROVE = 'invoices:approve';
const READ = 'members:read';

const requestContext = new AsyncLocalRequestContext();

let prisma: PrismaService;
let log: PrismaAuthorizationDecisionLog;

describe('PrismaAuthorizationDecisionLog (integração)', () => {
  let acme: SeededOrganization;
  let beta: SeededOrganization;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    log = new PrismaAuthorizationDecisionLog(
      new PrismaClientProvider(prisma),
      requestContext,
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "authorization_decisions", "invitations", "integration_clients", "memberships", "organizations", "users" CASCADE`;
    acme = await seedOrganization(prisma, { slug: 'acme' });
    beta = await seedOrganization(prisma, { slug: 'beta' });
  });

  function decision(
    decidedAt: Date,
    options: {
      organizationId?: string;
      clientId?: string;
      subjectUserId?: string;
      results?: PermissionDecision[];
    } = {},
  ) {
    return AuthorizationDecision.create(
      {
        organizationId: options.organizationId ?? acme.id,
        clientId: options.clientId ?? 'client-acme',
        subjectUserId: options.subjectUserId ?? SUBJECT,
        results: options.results ?? [{ permission: APPROVE, allowed: true }],
      },
      decidedAt,
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
    return items.map((item) => item.decision.id);
  }

  it('grava numa linha só e a leitura devolve a mesma decisão, com os resultados na ordem', async () => {
    const partial = decision(T0, {
      results: [
        { permission: READ, allowed: true },
        { permission: APPROVE, allowed: false },
      ],
    });

    await log.record(partial);

    const { items } = await log.listByOrganization(acme.id, { first: 10 });
    expect(items).toEqual([{ decision: partial, requestId: null }]);
    expect(
      await prisma.authorizationDecision.findUniqueOrThrow({
        where: { id: partial.id },
      }),
    ).toMatchObject({
      organizationId: acme.id,
      clientId: 'client-acme',
      subjectUserId: SUBJECT,
      results: [
        { permission: READ, allowed: true },
        { permission: APPROVE, allowed: false },
      ],
      allowed: false,
      requestId: null,
      decidedAt: T0,
    });
  });

  it('grava o id de correlação da requisição em andamento', async () => {
    const recorded = decision(T0);

    await requestContext.run({ requestId: 'req-authorize-01' }, () =>
      log.record(recorded),
    );

    const { items } = await log.listByOrganization(acme.id, { first: 10 });
    expect(items.map((i) => i.requestId)).toEqual(['req-authorize-01']);
  });

  it('pagina da mais recente para a mais antiga, estável com decidedAt empatado', async () => {
    const tied = Array.from({ length: 5 }, () => decision(at(10)));
    const all = [decision(at(0)), ...tied, decision(at(20))];
    for (const d of all) await log.record(d);

    const seen: string[] = [];
    let after: { decidedAt: Date; id: string } | undefined;
    let pages = 0;
    for (;;) {
      const page = await log.listByOrganization(acme.id, { first: 2, after });
      seen.push(...page.items.map((i) => i.decision.id));
      pages++;
      if (!page.hasNextPage) break;
      const last = page.items[page.items.length - 1].decision;
      after = { decidedAt: last.decidedAt, id: last.id };
    }

    const expected = [...all].sort(
      (a, b) =>
        b.decidedAt.getTime() - a.decidedAt.getTime() || (a.id < b.id ? 1 : -1),
    );
    expect(seen).toEqual(expected.map((d) => d.id));
    expect(pages).toBe(4);
  });

  describe('filtros', () => {
    let allowedOld: AuthorizationDecision;
    let deniedErp: AuthorizationDecision;
    let partialOther: AuthorizationDecision;
    let readOnly: AuthorizationDecision;

    beforeEach(async () => {
      allowedOld = decision(at(0));
      deniedErp = decision(at(10), {
        clientId: 'client-erp',
        results: [{ permission: APPROVE, allowed: false }],
      });
      partialOther = decision(at(20), {
        subjectUserId: OTHER_SUBJECT,
        results: [
          { permission: READ, allowed: true },
          { permission: APPROVE, allowed: false },
        ],
      });
      readOnly = decision(at(30), {
        results: [{ permission: READ, allowed: true }],
      });
      for (const d of [allowedOld, deniedErp, partialOther, readOnly]) {
        await log.record(d);
      }
      // Mesma chave e mesmo sujeito, em outra organização.
      await log.record(decision(at(15), { organizationId: beta.id }));
    });

    it('sem filtro: só a organização pedida', async () => {
      expect(await listAll()).toEqual([
        readOnly.id,
        partialOther.id,
        deniedErp.id,
        allowedOld.id,
      ]);
    });

    it('cada critério, e combinados com E', async () => {
      expect(await listAll({ subjectUserId: OTHER_SUBJECT })).toEqual([
        partialOther.id,
      ]);
      expect(await listAll({ clientId: 'client-erp' })).toEqual([deniedErp.id]);
      expect(await listAll({ allowed: true })).toEqual([
        readOnly.id,
        allowedOld.id,
      ]);
      expect(await listAll({ allowed: false })).toEqual([
        partialOther.id,
        deniedErp.id,
      ]);
      expect(await listAll({ decidedFrom: at(10), decidedTo: at(20) })).toEqual(
        [partialOther.id, deniedErp.id],
      );
      expect(
        await listAll({
          permission: APPROVE,
          allowed: false,
          subjectUserId: SUBJECT,
        }),
      ).toEqual([deniedErp.id]);
    });

    it('permission: alguma das chaves pedidas, permitida ou negada', async () => {
      expect(await listAll({ permission: APPROVE })).toEqual([
        partialOther.id,
        deniedErp.id,
        allowedOld.id,
      ]);
      expect(await listAll({ permission: READ })).toEqual([
        readOnly.id,
        partialOther.id,
      ]);
      expect(await listAll({ permission: 'contracts:sign' })).toEqual([]);
    });
  });

  describe('restrições do banco', () => {
    function insert(results: string, allowed: boolean) {
      return prisma.$executeRaw`
        INSERT INTO authorization_decisions
          (id, organization_id, client_id, subject_user_id, results, allowed, decided_at)
        VALUES
          (gen_random_uuid(), ${acme.id}::uuid, 'client-acme', ${SUBJECT}::uuid,
           ${results}::jsonb, ${allowed}, now())`;
    }

    it.each([
      ['lista vazia', '[]'],
      ['objeto no lugar da lista', '{"permission": "a:b", "allowed": true}'],
      ['item que não é objeto', '["a:b"]'],
      ['item sem permission', '[{"allowed": true}]'],
      ['item sem allowed', '[{"permission": "a:b"}]'],
      ['permission que não é texto', '[{"permission": 1, "allowed": true}]'],
      [
        'allowed que não é booleano',
        '[{"permission": "a:b", "allowed": "true"}]',
      ],
    ])('CHECK do results recusa %s', async (_, results) => {
      await expect(insert(results, true)).rejects.toThrow(
        /authorization_decisions_results_check/,
      );
    });

    it('CHECK do allowed: precisa ser true se, e só se, nenhuma chave foi negada', async () => {
      const partial =
        '[{"permission": "a:b", "allowed": true}, {"permission": "c:d", "allowed": false}]';
      const all = '[{"permission": "a:b", "allowed": true}]';

      await expect(insert(partial, true)).rejects.toThrow(
        /authorization_decisions_allowed_check/,
      );
      await expect(insert(all, false)).rejects.toThrow(
        /authorization_decisions_allowed_check/,
      );
      await insert(partial, false);
      await insert(all, true);
      expect(await prisma.authorizationDecision.count()).toBe(2);
    });
  });

  it('ação administrativa em andamento na organização: a gravação não espera a trava dela', async () => {
    // Toda ação administrativa trava a organização (FOR UPDATE). Sem FK, o
    // INSERT não precisa de trava na linha dela e termina com a transação
    // ainda aberta; com FK, esperaria o KEY SHARE até o timeout.
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${acme.id}::uuid FOR UPDATE`;

        const started = Date.now();
        await log.record(decision(T0));

        expect(Date.now() - started).toBeLessThan(1000);
      },
      { timeout: 3_000 },
    );
    expect(await prisma.authorizationDecision.count()).toBe(1);
  });
});
