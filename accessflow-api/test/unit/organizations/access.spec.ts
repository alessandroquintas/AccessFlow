import { beforeEach, describe, expect, it } from 'vitest';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { Role } from '@/modules/organizations/domain/entities/role.entity';

import { OrganizationAccessService } from '@/modules/organizations/application/services/organization-access.service';
import { UpdateOrganizationUseCase } from '@/modules/organizations/application/use-cases/update-organization.use-case';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { OrganizationPermissionDeniedError } from '@/modules/organizations/domain/errors/organization-permission-denied.error';
import { InvalidOrganizationError } from '@/modules/organizations/domain/errors/invalid-organization.error';
import { InMemoryOrganizationRepository } from '@test/in-memory/organizations/in-memory-organization-repository';
import { InMemoryMembershipRepository } from '@test/in-memory/organizations/in-memory-membership-repository';
import { InMemoryRoleRepository } from '@test/in-memory/organizations/in-memory-role-repository';
import { FakeUserDirectory } from '@test/fakes/organizations/fake-user-directory';
import { FakeTransactionManager } from '@test/fakes/shared/fake-transaction-manager';
import { FixedClock } from '@test/fakes/shared/fixed-clock';
import { OrganizationPermission } from '@/modules/organizations/policies/organization-permission';
import { InMemoryAuditLog } from '@test/in-memory/organizations/in-memory-audit-log';

const OWNER = { sub: 'sub-owner', id: '11111111-1111-4111-8111-111111111111' };
const MEMBER = {
  sub: 'sub-member',
  id: '22222222-2222-4222-8222-222222222222',
};
const OUTSIDER = {
  sub: 'sub-outsider',
  id: '33333333-3333-4333-8333-333333333333',
};

let roles: InMemoryRoleRepository;
let memberships: InMemoryMembershipRepository;
let organizations: InMemoryOrganizationRepository;
let access: OrganizationAccessService;
let updateOrganization: UpdateOrganizationUseCase;
let organization: Organization;

describe('Política de permissões', () => {
  const defaults = Role.createDefaults('org-1', new Date());

  it('OWNER tem todas as permissões', () => {
    for (const permission of Object.values(OrganizationPermission)) {
      expect(defaults.owner.grants(permission)).toBe(true);
    }
  });

  it('MEMBER só lê membros', () => {
    expect(defaults.member.grants(OrganizationPermission.MEMBERS_READ)).toBe(
      true,
    );
    expect(
      defaults.member.grants(OrganizationPermission.ORGANIZATIONS_UPDATE),
    ).toBe(false);
    expect(defaults.member.grants(OrganizationPermission.MEMBERS_REMOVE)).toBe(
      false,
    );
  });
});

describe('Acesso a organizações', () => {
  beforeEach(async () => {
    roles = new InMemoryRoleRepository();
    memberships = new InMemoryMembershipRepository(roles);
    organizations = new InMemoryOrganizationRepository();
    access = new OrganizationAccessService(organizations, memberships, roles);

    const users = new FakeUserDirectory();
    for (const user of [OWNER, MEMBER, OUTSIDER])
      users.register(user.sub, user.id);
    updateOrganization = new UpdateOrganizationUseCase(
      organizations,
      users,
      access,
      new InMemoryAuditLog(),
      new FakeTransactionManager(),
      new FixedClock(),
    );

    organization = Organization.create({ name: 'Acme', slug: 'acme' });
    await organizations.create(organization);
    const { owner, member } = roles.seedDefaults(organization.id);
    memberships.items.push(
      Membership.create({
        organizationId: organization.id,
        userId: OWNER.id,
        roleId: owner.id,
      }),
      Membership.create({
        organizationId: organization.id,
        userId: MEMBER.id,
        roleId: member.id,
      }),
    );
  });

  describe('requirePermission', () => {
    it('libera membro com a permissão', async () => {
      const result = await access.requirePermission(
        organization.id,
        MEMBER.id,
        OrganizationPermission.MEMBERS_READ,
      );
      expect(result.membership.userId).toBe(MEMBER.id);
    });

    it('nega membro sem a permissão com FORBIDDEN, levando a organização e a permissão', async () => {
      const error = await access
        .requirePermission(
          organization.id,
          MEMBER.id,
          OrganizationPermission.ORGANIZATIONS_UPDATE,
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(OrganizationPermissionDeniedError);
      expect(
        (error as OrganizationPermissionDeniedError).securityDenial,
      ).toEqual({
        event: 'access.forbidden',
        organizationId: organization.id,
        permission: OrganizationPermission.ORGANIZATIONS_UPDATE,
      });
    });

    it('membership removido não tem permissão nenhuma', async () => {
      memberships.items.find((m) => m.userId === OWNER.id)!.remove();

      await expect(
        access.requirePermission(
          organization.id,
          OWNER.id,
          OrganizationPermission.MEMBERS_READ,
        ),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });

    it('não membro recebe NOT_FOUND, mesmo pedindo permissão, e não vira evento', async () => {
      const error = await access
        .requirePermission(
          organization.id,
          OUTSIDER.id,
          OrganizationPermission.MEMBERS_READ,
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(OrganizationNotFoundError);
      expect(
        (error as OrganizationNotFoundError).securityDenial,
      ).toBeUndefined();
    });
  });

  describe('UpdateOrganizationUseCase', () => {
    it('OWNER renomeia a organização', async () => {
      const result = await updateOrganization.execute({
        cognitoSub: OWNER.sub,
        organizationId: organization.id,
        name: 'Acme Global',
      });

      expect(result.organization.name).toBe('Acme Global');
      expect((await organizations.findById(organization.id))?.name).toBe(
        'Acme Global',
      );
    });

    it('MEMBER não pode renomear, e nada muda', async () => {
      await expect(
        updateOrganization.execute({
          cognitoSub: MEMBER.sub,
          organizationId: organization.id,
          name: 'Hack',
        }),
      ).rejects.toBeInstanceOf(OrganizationPermissionDeniedError);

      expect((await organizations.findById(organization.id))?.name).toBe(
        'Acme',
      );
    });

    it('não membro recebe NOT_FOUND antes de qualquer validação do nome', async () => {
      await expect(
        updateOrganization.execute({
          cognitoSub: OUTSIDER.sub,
          organizationId: organization.id,
          name: ' ',
        }),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });

    it('OWNER com nome inválido recebe erro de validação', async () => {
      await expect(
        updateOrganization.execute({
          cognitoSub: OWNER.sub,
          organizationId: organization.id,
          name: ' ',
        }),
      ).rejects.toBeInstanceOf(InvalidOrganizationError);
    });
  });
});
