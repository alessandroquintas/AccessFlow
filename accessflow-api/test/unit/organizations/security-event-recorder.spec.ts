import { beforeEach, describe, expect, it } from 'vitest';
import {
  IntegrationClient,
  IntegrationClientStatus,
} from '@/modules/organizations/domain/entities/integration-client.entity';
import { SecurityEventRecorder } from '@/modules/organizations/application/services/security-event-recorder';
import { UserNotFoundError } from '@/modules/identity/domain/errors/user-not-found.error';
import { AsyncLocalRequestContext } from '@/shared/infrastructure/request-context/async-local-request-context';
import { InMemorySecurityEventLog } from '@test/in-memory/organizations/in-memory-security-event-log';
import { InMemoryIntegrationClientRepository } from '@test/in-memory/organizations/in-memory-integration-client-repository';
import { FakeUserDirectory } from '@test/fakes/organizations/fake-user-directory';
import { FixedClock } from '@test/fakes/shared/fixed-clock';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const ACME = '11111111-1111-4111-8111-111111111111';
const BETA = '22222222-2222-4222-8222-222222222222';
const ANA = { sub: 'sub-ana', id: '33333333-3333-4333-8333-333333333333' };
const ROUTE = 'GET /v1/organizations/:organizationId/members/:userId';

const requestContext = new AsyncLocalRequestContext();

let log: InMemorySecurityEventLog;
let clients: InMemoryIntegrationClientRepository;
let sut: SecurityEventRecorder;

function addClient(
  clientId: string,
  organizationId: string,
  status: IntegrationClientStatus = IntegrationClientStatus.ACTIVE,
) {
  clients.items.push(
    IntegrationClient.restore({
      id: crypto.randomUUID(),
      clientId,
      organizationId,
      name: clientId,
      status,
      createdAt: NOW,
      updatedAt: NOW,
    }),
  );
}

/** O único evento gravado, como a tabela o guardaria. */
function recorded() {
  expect(log.items).toHaveLength(1);
  const [{ event, requestId }] = log.items;
  return {
    organizationId: event.organizationId,
    actor: event.actor,
    event: event.event,
    details: event.details,
    occurredAt: event.occurredAt,
    requestId,
  };
}

describe('SecurityEventRecorder', () => {
  beforeEach(() => {
    log = new InMemorySecurityEventLog(requestContext);
    clients = new InMemoryIntegrationClientRepository();
    const users = new FakeUserDirectory();
    users.register(ANA.sub, ANA.id);
    sut = new SecurityEventRecorder(log, users, clients, new FixedClock(NOW));
    addClient('client-acme', ACME);
    addClient('client-revogado', BETA, IntegrationClientStatus.REVOKED);
  });

  describe('negações de usuário: o ator é o usuário autenticado', () => {
    it('access.forbidden, com a operação e a permissão', async () => {
      await requestContext.run({ requestId: 'req-negado-01' }, () =>
        sut.record(
          {
            event: 'access.forbidden',
            organizationId: ACME,
            permission: 'roles:manage',
          },
          { operation: 'createRole', userSub: ANA.sub },
        ),
      );

      expect(recorded()).toEqual({
        organizationId: ACME,
        actor: { type: 'USER', userId: ANA.id },
        event: 'access.forbidden',
        details: { operation: 'createRole', permission: 'roles:manage' },
        occurredAt: NOW,
        requestId: 'req-negado-01',
      });
    });

    it('access.privilege_escalation, com a operação', async () => {
      await sut.record(
        { event: 'access.privilege_escalation', organizationId: ACME },
        { operation: 'assignRole', userSub: ANA.sub },
      );

      expect(recorded()).toMatchObject({
        organizationId: ACME,
        actor: { type: 'USER', userId: ANA.id },
        details: { operation: 'assignRole' },
      });
    });

    it.each([
      ['sem usuário autenticado', { operation: 'createRole' }, 'userSub'],
      [
        'sem operação (veio por HTTP)',
        { route: ROUTE, userSub: ANA.sub },
        'operation',
      ],
    ])('%s: lança e não grava', async (_, origin, missing) => {
      await expect(
        sut.record(
          { event: 'access.privilege_escalation', organizationId: ACME },
          origin,
        ),
      ).rejects.toThrow(`Negação sem ${missing} na origem.`);
      expect(log.items).toEqual([]);
    });

    it('usuário que não se encontra: o erro sobe e nada é gravado', async () => {
      await expect(
        sut.record(
          { event: 'access.privilege_escalation', organizationId: ACME },
          { operation: 'createRole', userSub: 'sub-desconhecido' },
        ),
      ).rejects.toBeInstanceOf(UserNotFoundError);
      expect(log.items).toEqual([]);
    });
  });

  describe('negações de máquina: a organização é a do cadastro do client', () => {
    it('machine.scope_denied, com a rota e os escopos exigidos', async () => {
      await sut.record(
        {
          event: 'machine.scope_denied',
          clientId: 'client-acme',
          requiredScopes: ['accessflow-api/members.read'],
        },
        { route: ROUTE },
      );

      expect(recorded()).toEqual({
        organizationId: ACME,
        actor: { type: 'MACHINE', clientId: 'client-acme' },
        event: 'machine.scope_denied',
        details: {
          route: ROUTE,
          requiredScopes: ['accessflow-api/members.read'],
        },
        occurredAt: NOW,
        requestId: null,
      });
    });

    it.each([
      ['client ativo: a organização dele', 'client-acme', ACME],
      [
        'client revogado: a organização em que foi cadastrado',
        'client-revogado',
        BETA,
      ],
      ['client não cadastrado: nenhuma', 'client-desconhecido', null],
    ])(
      'machine.organization_denied, %s',
      async (_, clientId, organizationId) => {
        await sut.record(
          { event: 'machine.organization_denied', clientId },
          { route: 'POST /v1/authorize' },
        );

        expect(recorded()).toMatchObject({
          organizationId,
          actor: { type: 'MACHINE', clientId },
          details: { route: 'POST /v1/authorize' },
        });
      },
    );

    it('sem rota (veio pelo GraphQL): lança e não grava', async () => {
      await expect(
        sut.record(
          { event: 'machine.organization_denied', clientId: 'client-acme' },
          { operation: 'authorize' },
        ),
      ).rejects.toThrow('Negação sem route na origem.');
      expect(log.items).toEqual([]);
    });
  });

  it('a falha do repositório sobe para quem chamou', async () => {
    const failure = new Error('banco fora');
    log.failWith(failure);

    await expect(
      sut.record(
        { event: 'machine.organization_denied', clientId: 'client-acme' },
        { route: ROUTE },
      ),
    ).rejects.toBe(failure);
  });
});
