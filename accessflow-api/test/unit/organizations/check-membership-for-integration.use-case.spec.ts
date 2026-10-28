import { beforeEach, describe, expect, it } from 'vitest';
import {
  Organization,
  OrganizationStatus,
} from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { RoleSystemKey } from '@/modules/organizations/domain/entities/role.entity';
import {
  IntegrationClient,
  IntegrationClientStatus,
} from '@/modules/organizations/domain/entities/integration-client.entity';
import { CheckMembershipForIntegrationUseCase } from '@/modules/organizations/application/use-cases/check-membership-for-integration.use-case';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { MemberNotFoundError } from '@/modules/organizations/domain/errors/member-not-found.error';
import { InMemoryOrganizationRepository } from '@test/in-memory/organizations/in-memory-organization-repository';
import { InMemoryMembershipRepository } from '@test/in-memory/organizations/in-memory-membership-repository';
import { InMemoryRoleRepository } from '@test/in-memory/organizations/in-memory-role-repository';
import { InMemoryIntegrationClientRepository } from '@test/in-memory/organizations/in-memory-integration-client-repository';
import { FakeUserDirectory } from '@test/fakes/organizations/fake-user-directory';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const OUTSIDER_ID = '33333333-3333-4333-8333-333333333333';
const INACTIVE_ID = '44444444-4444-4444-8444-444444444444';
const REMOVED_ID = '55555555-5555-4555-8555-555555555555';
const JOINED_AT = new Date('2026-01-02T00:00:00.000Z');

let roles: InMemoryRoleRepository;
let memberships: InMemoryMembershipRepository;
let organizations: InMemoryOrganizationRepository;
let integrationClients: InMemoryIntegrationClientRepository;
let sut: CheckMembershipForIntegrationUseCase;
let acme: Organization;
let beta: Organization;

function addClient(
  clientId: string,
  organizationId: string,
  status: IntegrationClientStatus = IntegrationClientStatus.ACTIVE,
) {
  integrationClients.items.push(
    IntegrationClient.restore({
      id: crypto.randomUUID(),
      clientId,
      organizationId,
      name: clientId,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
}

function addMember(
  organizationId: string,
  userId: string,
  role: RoleSystemKey = RoleSystemKey.MEMBER,
) {
  const membership = Membership.create(
    {
      organizationId,
      userId,
      roleId: roles.systemRole(organizationId, role).id,
    },
    JOINED_AT,
  );
  memberships.items.push(membership);
  return membership;
}

describe('CheckMembershipForIntegrationUseCase', () => {
  beforeEach(async () => {
    roles = new InMemoryRoleRepository();
    memberships = new InMemoryMembershipRepository(roles);
    organizations = new InMemoryOrganizationRepository();
    integrationClients = new InMemoryIntegrationClientRepository();
    const users = new FakeUserDirectory();
    for (const id of [OWNER_ID, MEMBER_ID, OUTSIDER_ID, REMOVED_ID]) {
      users.register(`sub-${id}`, id);
    }
    users.register(`sub-${INACTIVE_ID}`, INACTIVE_ID, { active: false });

    sut = new CheckMembershipForIntegrationUseCase(
      integrationClients,
      organizations,
      memberships,
      roles,
      users,
    );

    acme = Organization.create({ name: 'Acme', slug: 'acme' });
    await organizations.create(acme);
    roles.seedDefaults(acme.id);
    addMember(acme.id, OWNER_ID, RoleSystemKey.OWNER);
    beta = Organization.create({ name: 'Beta', slug: 'beta' });
    await organizations.create(beta);
    roles.seedDefaults(beta.id);
    addMember(beta.id, OWNER_ID, RoleSystemKey.OWNER);

    addMember(acme.id, MEMBER_ID);
    addMember(acme.id, INACTIVE_ID);
    addMember(acme.id, REMOVED_ID).remove();
    addClient('client-acme', acme.id);
    addClient('client-revogado', acme.id, IntegrationClientStatus.REVOKED);
  });

  it('confirma membro ativo com papel e data de entrada', async () => {
    const result = await sut.execute({
      clientId: 'client-acme',
      organizationId: acme.id,
      userId: MEMBER_ID,
    });

    expect(result).toEqual({
      organizationId: acme.id,
      userId: MEMBER_ID,
      role: roles.systemRole(acme.id, RoleSystemKey.MEMBER),
      joinedAt: JOINED_AT,
    });
  });

  it('aceita ids em maiúsculas', async () => {
    const result = await sut.execute({
      clientId: 'client-acme',
      organizationId: acme.id.toUpperCase(),
      userId: MEMBER_ID.toUpperCase(),
    });

    expect(result.userId).toBe(MEMBER_ID);
  });

  describe('responde ORGANIZATION_NOT_FOUND', () => {
    it.each([
      ['client inexistente', 'client-desconhecido', () => acme.id],
      ['client revogado', 'client-revogado', () => acme.id],
      ['organização de outro tenant', 'client-acme', () => beta.id],
    ])(
      'para %s, e a negação vira machine.organization_denied',
      async (_cenario, clientId, organizationId) => {
        const error = await sut
          .execute({
            clientId,
            organizationId: organizationId(),
            userId: MEMBER_ID,
          })
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(OrganizationNotFoundError);
        expect((error as OrganizationNotFoundError).securityDenial).toEqual({
          event: 'machine.organization_denied',
          clientId,
        });
      },
    );

    it('para organizationId que não é UUID', async () => {
      await expect(
        sut.execute({
          clientId: 'client-acme',
          organizationId: 'nao-e-uuid',
          userId: MEMBER_ID,
        }),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });

    it('para organização inexistente', async () => {
      const ghostId = crypto.randomUUID();
      addClient('client-fantasma', ghostId);

      await expect(
        sut.execute({
          clientId: 'client-fantasma',
          organizationId: ghostId,
          userId: MEMBER_ID,
        }),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });

    it('para organização inativa', async () => {
      const inactive = Organization.restore({
        id: crypto.randomUUID(),
        name: 'Inativa',
        slug: 'inativa',
        status: OrganizationStatus.INACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      organizations.items.push(inactive);
      roles.seedDefaults(inactive.id);
      addMember(inactive.id, MEMBER_ID);
      addClient('client-inativa', inactive.id);

      const error = await sut
        .execute({
          clientId: 'client-inativa',
          organizationId: inactive.id,
          userId: MEMBER_ID,
        })
        .catch((e: unknown) => e);

      // Dentro do vínculo: é organização inexistente, não negação.
      expect(error).toBeInstanceOf(OrganizationNotFoundError);
      expect(
        (error as OrganizationNotFoundError).securityDenial,
      ).toBeUndefined();
    });
  });

  describe('responde MEMBER_NOT_FOUND', () => {
    it.each([
      ['userId que não é UUID', 'nao-e-uuid'],
      ['usuário que não é membro', OUTSIDER_ID],
      ['membro removido', REMOVED_ID],
      ['usuário inativo', INACTIVE_ID],
    ])('para %s', async (_cenario, userId) => {
      await expect(
        sut.execute({
          clientId: 'client-acme',
          organizationId: acme.id,
          userId,
        }),
      ).rejects.toBeInstanceOf(MemberNotFoundError);
    });
  });
});
