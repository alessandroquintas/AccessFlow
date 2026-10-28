import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import {
  AuditAction,
  AuditActorType,
  AuditEvent,
} from '@/modules/organizations/domain/entities/audit-event.entity';
import { RoleSystemKey } from '@/modules/organizations/domain/entities/role.entity';
import { OrganizationPermission } from '@/modules/organizations/policies/organization-permission';
import { OrganizationAccessService } from '@/modules/organizations/application/services/organization-access.service';
import { ListAuditEventsUseCase } from '@/modules/organizations/application/use-cases/list-audit-events.use-case';
import { InvalidAuditFilterError } from '@/modules/organizations/application/errors/invalid-audit-filter.error';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { OrganizationPermissionDeniedError } from '@/modules/organizations/domain/errors/organization-permission-denied.error';
import { InMemoryOrganizationRepository } from '@test/in-memory/organizations/in-memory-organization-repository';
import { InMemoryMembershipRepository } from '@test/in-memory/organizations/in-memory-membership-repository';
import { InMemoryRoleRepository } from '@test/in-memory/organizations/in-memory-role-repository';
import { InMemoryAuditLog } from '@test/in-memory/organizations/in-memory-audit-log';
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
/** Ator gravado na trilha, sem perfil no diretório. */
const GHOST_ID = '44444444-4444-4444-8444-444444444444';

const requestContext = new AsyncLocalRequestContext();

let roles: InMemoryRoleRepository;
let audit: InMemoryAuditLog;
let users: FakeUserDirectory;
let sut: ListAuditEventsUseCase;
let acme: Organization;
let beta: Organization;

function event(
  minutes: number,
  options: { actorId?: string; roleId?: string; organizationId?: string } = {},
): AuditEvent {
  return AuditEvent.create(
    {
      organizationId: options.organizationId ?? acme.id,
      actor: { type: AuditActorType.USER, userId: options.actorId ?? OWNER.id },
      action: AuditAction.ROLE_CREATED,
      targetId: options.roleId ?? 'role-1',
      details: { name: 'Financeiro', permissions: [] },
    },
    at(minutes),
  );
}

function list(
  who: { sub: string } = OWNER,
  options: Partial<Parameters<ListAuditEventsUseCase['execute']>[0]> = {},
) {
  return sut.execute({
    cognitoSub: who.sub,
    organizationId: acme.id,
    first: 20,
    ...options,
  });
}

describe('ListAuditEventsUseCase', () => {
  beforeEach(async () => {
    roles = new InMemoryRoleRepository();
    const memberships = new InMemoryMembershipRepository(roles);
    const organizations = new InMemoryOrganizationRepository();
    audit = new InMemoryAuditLog(requestContext);
    users = new FakeUserDirectory();
    users.register(OWNER.sub, OWNER.id, { name: 'Olga' });
    users.register(MEMBER.sub, MEMBER.id, { name: 'Mário', active: true });
    users.register(OUTSIDER.sub, OUTSIDER.id);
    sut = new ListAuditEventsUseCase(
      audit,
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

    it('só a organização pedida, mais recentes primeiro', async () => {
      const [old, recent] = [event(0), event(10)];
      for (const e of [old, recent, event(5, { organizationId: beta.id })]) {
        await audit.record(e);
      }

      const { items } = await list(OWNER, {
        organizationId: acme.id.toUpperCase(),
      });

      expect(items.map((i) => i.event.id)).toEqual([recent.id, old.id]);
    });
  });

  describe('nome do ator', () => {
    it('uma consulta por página, com os ids sem repetição; perfil não encontrado vira null', async () => {
      for (const e of [
        event(0),
        event(1, { actorId: MEMBER.id }),
        event(2),
        event(3, { actorId: GHOST_ID }),
      ]) {
        await audit.record(e);
      }
      const getProfiles = vi.spyOn(users, 'getProfilesByIds');

      const { items } = await list();

      expect(getProfiles).toHaveBeenCalledTimes(1);
      expect([...getProfiles.mock.calls[0][0]].sort()).toEqual(
        [OWNER.id, MEMBER.id, GHOST_ID].sort(),
      );
      expect(items.map((i) => i.actorName)).toEqual([
        null,
        'Olga',
        'Mário',
        'Olga',
      ]);
    });

    it('cada item traz o requestId com que o evento foi gravado', async () => {
      const [inRequest, outside] = [event(1), event(0)];
      await requestContext.run({ requestId: 'req-lista-0001' }, () =>
        audit.record(inRequest),
      );
      await audit.record(outside);

      const { items } = await list();

      expect(items.map((i) => [i.event.id, i.requestId])).toEqual([
        [inRequest.id, 'req-lista-0001'],
        [outside.id, null],
      ]);
    });

    it('página vazia não consulta o diretório', async () => {
      const getProfiles = vi.spyOn(users, 'getProfilesByIds');

      await expect(list()).resolves.toEqual({ items: [], hasNextPage: false });
      expect(getProfiles).not.toHaveBeenCalled();
    });
  });

  describe('filtro', () => {
    it('normaliza actorUserId e targetId; lista de ações vazia não filtra', async () => {
      const mine = event(0, { actorId: MEMBER.id, roleId: 'role-x' });
      await audit.record(mine);
      await audit.record(event(1));

      const byActor = await list(OWNER, {
        filter: { actorUserId: MEMBER.id.toUpperCase(), actions: [] },
      });
      const byTarget = await list(OWNER, {
        filter: { targetType: 'role', targetId: 'ROLE-X' },
      });

      expect(byActor.items.map((i) => i.event.id)).toEqual([mine.id]);
      expect(byTarget.items.map((i) => i.event.id)).toEqual([mine.id]);
    });

    it.each([
      ['ação fora do catálogo', { actions: ['role.created', 'role.renamed'] }],
      ['tipo de alvo fora do catálogo', { targetType: 'user' }],
      ['actorUserId que não é UUID', { actorUserId: 'olga' }],
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
      const exact = event(5);
      await audit.record(exact);

      const { items } = await list(OWNER, {
        filter: { occurredFrom: at(5), occurredTo: at(5) },
      });

      expect(items.map((i) => i.event.id)).toEqual([exact.id]);
    });
  });
});
