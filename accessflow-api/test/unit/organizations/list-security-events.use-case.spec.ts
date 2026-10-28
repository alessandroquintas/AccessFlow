import { beforeEach, describe, expect, it } from 'vitest';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { RoleSystemKey } from '@/modules/organizations/domain/entities/role.entity';
import {
  SecurityActor,
  SecurityEvent,
} from '@/modules/organizations/domain/entities/security-event.entity';
import { OrganizationPermission } from '@/modules/organizations/policies/organization-permission';
import { OrganizationAccessService } from '@/modules/organizations/application/services/organization-access.service';
import { ListSecurityEventsUseCase } from '@/modules/organizations/application/use-cases/list-security-events.use-case';
import { InvalidAuditFilterError } from '@/modules/organizations/application/errors/invalid-audit-filter.error';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { OrganizationPermissionDeniedError } from '@/modules/organizations/domain/errors/organization-permission-denied.error';
import { InMemoryOrganizationRepository } from '@test/in-memory/organizations/in-memory-organization-repository';
import { InMemoryMembershipRepository } from '@test/in-memory/organizations/in-memory-membership-repository';
import { InMemoryRoleRepository } from '@test/in-memory/organizations/in-memory-role-repository';
import { InMemorySecurityEventLog } from '@test/in-memory/organizations/in-memory-security-event-log';
import { FakeUserDirectory } from '@test/fakes/organizations/fake-user-directory';
import { AsyncLocalRequestContext } from '@/shared/infrastructure/request-context/async-local-request-context';

const T0 = new Date('2026-03-01T12:00:00.000Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

const OWNER = { sub: 'sub-owner', id: '11111111-1111-4111-8111-111111111111' };
const MEMBER = {
  sub: 'sub-member',
  id: '22222222-2222-4222-8222-222222222222',
};
const OUTSIDER = {
  sub: 'sub-outsider',
  id: '33333333-3333-4333-8333-333333333333',
};
/** Ex-usuário: o perfil não existe mais. */
const GHOST = '44444444-4444-4444-8444-444444444444';

const requestContext = new AsyncLocalRequestContext();

let roles: InMemoryRoleRepository;
let securityEvents: InMemorySecurityEventLog;
let sut: ListSecurityEventsUseCase;
let acme: Organization;
let beta: Organization;

const user = (userId: string): SecurityActor => ({ type: 'USER', userId });
const machine = (clientId: string): SecurityActor => ({
  type: 'MACHINE',
  clientId,
});

function forbidden(
  minutes: number,
  options: { organizationId?: string; actor?: SecurityActor } = {},
): SecurityEvent {
  return SecurityEvent.create(
    {
      organizationId: options.organizationId ?? acme.id,
      actor: options.actor ?? user(MEMBER.id),
      event: 'access.forbidden',
      details: { operation: 'createRole', permission: 'roles:manage' },
    },
    at(minutes),
  );
}

function orgDenied(minutes: number, clientId = 'client-acme'): SecurityEvent {
  return SecurityEvent.create(
    {
      organizationId: acme.id,
      actor: machine(clientId),
      event: 'machine.organization_denied',
      details: { route: 'POST /v1/authorize' },
    },
    at(minutes),
  );
}

function list(
  who: { sub: string } = OWNER,
  options: Partial<Parameters<ListSecurityEventsUseCase['execute']>[0]> = {},
) {
  return sut.execute({
    cognitoSub: who.sub,
    organizationId: acme.id,
    first: 20,
    ...options,
  });
}

describe('ListSecurityEventsUseCase', () => {
  beforeEach(async () => {
    roles = new InMemoryRoleRepository();
    const memberships = new InMemoryMembershipRepository(roles);
    const organizations = new InMemoryOrganizationRepository();
    securityEvents = new InMemorySecurityEventLog(requestContext);
    const users = new FakeUserDirectory();
    users.register(OWNER.sub, OWNER.id, { name: 'Ana' });
    users.register(MEMBER.sub, MEMBER.id, { name: 'Bruno' });
    users.register(OUTSIDER.sub, OUTSIDER.id);
    sut = new ListSecurityEventsUseCase(
      securityEvents,
      users,
      new OrganizationAccessService(organizations, memberships, roles),
    );

    acme = Organization.create({ name: 'Acme', slug: 'acme' });
    beta = Organization.create({ name: 'Beta', slug: 'beta' });
    for (const organization of [acme, beta]) {
      await organizations.create(organization);
      roles.seedDefaults(organization.id);
    }
    for (const [userId, key] of [
      [OWNER.id, RoleSystemKey.OWNER],
      [MEMBER.id, RoleSystemKey.MEMBER],
    ] as const) {
      memberships.items.push(
        Membership.create({
          organizationId: acme.id,
          userId,
          roleId: roles.systemRole(acme.id, key).id,
        }),
      );
    }
  });

  describe('acesso', () => {
    it('exige audit:read: MEMBER recebe FORBIDDEN até ganhar a permissão', async () => {
      await expect(list(MEMBER)).rejects.toBeInstanceOf(
        OrganizationPermissionDeniedError,
      );

      roles.grant(
        roles.systemRole(acme.id, RoleSystemKey.MEMBER).id,
        OrganizationPermission.AUDIT_READ,
      );
      await expect(list(MEMBER)).resolves.toBeDefined();
    });

    it('não membro recebe NOT_FOUND', async () => {
      await expect(list(OUTSIDER)).rejects.toBeInstanceOf(
        OrganizationNotFoundError,
      );
    });
  });

  it('só a organização pedida, mais recentes primeiro, com o requestId gravado', async () => {
    const [old, recent] = [forbidden(0), orgDenied(10)];
    await securityEvents.record(old);
    await requestContext.run({ requestId: 'req-negado-02' }, () =>
      securityEvents.record(recent),
    );
    await securityEvents.record(forbidden(5, { organizationId: beta.id }));

    const { items } = await list(OWNER, {
      organizationId: acme.id.toUpperCase(),
    });

    expect(items.map((i) => [i.event.id, i.requestId])).toEqual([
      [recent.id, 'req-negado-02'],
      [old.id, null],
    ]);
  });

  it('nomes dos usuários da página numa consulta; client e perfil sumido ficam sem nome', async () => {
    await securityEvents.record(forbidden(0, { actor: user(GHOST) }));
    await securityEvents.record(orgDenied(1));
    await securityEvents.record(forbidden(2));
    await securityEvents.record(forbidden(3));

    const { items } = await list();

    expect(items.map((i) => i.actorName)).toEqual([
      'Bruno',
      'Bruno',
      null,
      null,
    ]);
  });

  describe('filtro', () => {
    it('eventos, ator usuário (normalizado) e ator client', async () => {
      const mine = forbidden(0);
      const erp = orgDenied(1, 'client-erp');
      await securityEvents.record(mine);
      await securityEvents.record(erp);
      await securityEvents.record(orgDenied(2));

      const ids = async (filter: object) =>
        (await list(OWNER, { filter })).items.map((i) => i.event.id);

      expect(await ids({ events: ['access.forbidden'] })).toEqual([mine.id]);
      expect(await ids({ actorUserId: MEMBER.id.toUpperCase() })).toEqual([
        mine.id,
      ]);
      expect(await ids({ actorClientId: 'client-erp' })).toEqual([erp.id]);
      expect(await ids({ events: [] })).toHaveLength(3);
    });

    it.each([
      ['evento fora do catálogo', { events: ['access.denied'] }],
      ['actorUserId que não é UUID', { actorUserId: 'fulano' }],
      ['actorClientId vazio', { actorClientId: '  ' }],
      ['período invertido', { occurredFrom: at(10), occurredTo: at(0) }],
    ])(
      '%s: INVALID_AUDIT_FILTER, antes até da checagem de acesso',
      async (_, filter) => {
        for (const who of [OWNER, OUTSIDER]) {
          await expect(list(who, { filter })).rejects.toBeInstanceOf(
            InvalidAuditFilterError,
          );
        }
      },
    );

    it('período com as duas pontas iguais é válido (inclusivo)', async () => {
      const exact = forbidden(5);
      await securityEvents.record(exact);

      const { items } = await list(OWNER, {
        filter: { occurredFrom: at(5), occurredTo: at(5) },
      });

      expect(items.map((i) => i.event.id)).toEqual([exact.id]);
    });
  });
});
