import { beforeEach, describe, expect, it } from 'vitest';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { RoleSystemKey } from '@/modules/organizations/domain/entities/role.entity';
import { AuthorizationDecision } from '@/modules/organizations/domain/entities/authorization-decision.entity';
import { OrganizationPermission } from '@/modules/organizations/policies/organization-permission';
import { OrganizationAccessService } from '@/modules/organizations/application/services/organization-access.service';
import { ListAuthorizationDecisionsUseCase } from '@/modules/organizations/application/use-cases/list-authorization-decisions.use-case';
import { InvalidAuditFilterError } from '@/modules/organizations/application/errors/invalid-audit-filter.error';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { OrganizationPermissionDeniedError } from '@/modules/organizations/domain/errors/organization-permission-denied.error';
import { InMemoryOrganizationRepository } from '@test/in-memory/organizations/in-memory-organization-repository';
import { InMemoryMembershipRepository } from '@test/in-memory/organizations/in-memory-membership-repository';
import { InMemoryRoleRepository } from '@test/in-memory/organizations/in-memory-role-repository';
import { InMemoryAuthorizationDecisionLog } from '@test/in-memory/organizations/in-memory-authorization-decision-log';
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
const SUBJECT = '44444444-4444-4444-8444-444444444444';

const requestContext = new AsyncLocalRequestContext();

let roles: InMemoryRoleRepository;
let decisions: InMemoryAuthorizationDecisionLog;
let sut: ListAuthorizationDecisionsUseCase;
let acme: Organization;
let beta: Organization;

function decision(
  minutes: number,
  options: { organizationId?: string; subjectUserId?: string } = {},
): AuthorizationDecision {
  return AuthorizationDecision.create(
    {
      organizationId: options.organizationId ?? acme.id,
      clientId: 'client-acme',
      subjectUserId: options.subjectUserId ?? SUBJECT,
      results: [{ permission: 'invoices:approve', allowed: true }],
    },
    at(minutes),
  );
}

function list(
  who: { sub: string } = OWNER,
  options: Partial<
    Parameters<ListAuthorizationDecisionsUseCase['execute']>[0]
  > = {},
) {
  return sut.execute({
    cognitoSub: who.sub,
    organizationId: acme.id,
    first: 20,
    ...options,
  });
}

describe('ListAuthorizationDecisionsUseCase', () => {
  beforeEach(async () => {
    roles = new InMemoryRoleRepository();
    const memberships = new InMemoryMembershipRepository(roles);
    const organizations = new InMemoryOrganizationRepository();
    decisions = new InMemoryAuthorizationDecisionLog(requestContext);
    const users = new FakeUserDirectory();
    users.register(OWNER.sub, OWNER.id);
    users.register(MEMBER.sub, MEMBER.id);
    users.register(OUTSIDER.sub, OUTSIDER.id);
    sut = new ListAuthorizationDecisionsUseCase(
      decisions,
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
    const [old, recent] = [decision(0), decision(10)];
    await decisions.record(old);
    await requestContext.run({ requestId: 'req-decisao-01' }, () =>
      decisions.record(recent),
    );
    await decisions.record(decision(5, { organizationId: beta.id }));

    const { items } = await list(OWNER, {
      organizationId: acme.id.toUpperCase(),
    });

    expect(items.map((i) => [i.decision.id, i.requestId])).toEqual([
      [recent.id, 'req-decisao-01'],
      [old.id, null],
    ]);
  });

  describe('filtro', () => {
    it('normaliza o subjectUserId', async () => {
      const mine = decision(0);
      await decisions.record(mine);
      await decisions.record(
        decision(1, { subjectUserId: '55555555-5555-4555-8555-555555555555' }),
      );

      const { items } = await list(OWNER, {
        filter: { subjectUserId: SUBJECT.toUpperCase() },
      });

      expect(items.map((i) => i.decision.id)).toEqual([mine.id]);
    });

    it.each([
      ['subjectUserId que não é UUID', { subjectUserId: 'fulano' }],
      ['chave fora do formato', { permission: 'Invoices:Approve' }],
      ['período invertido', { decidedFrom: at(10), decidedTo: at(0) }],
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

    it('chave fora do catálogo, mas no formato, é aceita: a apagada fica nas decisões antigas', async () => {
      await expect(
        list(OWNER, { filter: { permission: 'legacy:approve' } }),
      ).resolves.toEqual({ items: [], hasNextPage: false });
    });

    it('período com as duas pontas iguais é válido (inclusivo)', async () => {
      const exact = decision(5);
      await decisions.record(exact);

      const { items } = await list(OWNER, {
        filter: { decidedFrom: at(5), decidedTo: at(5) },
      });

      expect(items.map((i) => i.decision.id)).toEqual([exact.id]);
    });
  });
});
