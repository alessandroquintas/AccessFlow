import { beforeEach, describe, expect, it } from 'vitest';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import {
  Membership,
  MembershipRole,
} from '@/modules/organizations/domain/entities/membership.entity';

import { OrganizationAccessService } from '@/modules/organizations/application/services/organization-access.service';
import { UpdateOrganizationUseCase } from '@/modules/organizations/application/use-cases/update-organization.use-case';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { OrganizationPermissionDeniedError } from '@/modules/organizations/domain/errors/organization-permission-denied.error';
import { InvalidOrganizationError } from '@/modules/organizations/domain/errors/invalid-organization.error';
import { InMemoryOrganizationRepository } from '@test/in-memory/organizations/in-memory-organization-repository';
import { InMemoryMembershipRepository } from '@test/in-memory/organizations/in-memory-membership-repository';
import { FakeUserDirectory } from '@test/fakes/organizations/fake-user-directory';
import {
  OrganizationPermission,
  roleHasPermission,
} from '@/modules/organizations/policies/organization-permission';

const OWNER = { sub: 'sub-owner', id: '11111111-1111-4111-8111-111111111111' };
const MEMBER = {
  sub: 'sub-member',
  id: '22222222-2222-4222-8222-222222222222',
};
const OUTSIDER = {
  sub: 'sub-outsider',
  id: '33333333-3333-4333-8333-333333333333',
};

let memberships: InMemoryMembershipRepository;
let organizations: InMemoryOrganizationRepository;
let access: OrganizationAccessService;
let updateOrganization: UpdateOrganizationUseCase;
let organization: Organization;

describe('Política de permissões', () => {
  it('OWNER tem todas as permissões', () => {
    for (const permission of Object.values(OrganizationPermission)) {
      expect(roleHasPermission(MembershipRole.OWNER, permission)).toBe(true);
    }
  });

  it('MEMBER só lê membros', () => {
    expect(
      roleHasPermission(
        MembershipRole.MEMBER,
        OrganizationPermission.MEMBERS_READ,
      ),
    ).toBe(true);
    expect(
      roleHasPermission(
        MembershipRole.MEMBER,
        OrganizationPermission.ORGANIZATIONS_UPDATE,
      ),
    ).toBe(false);
    expect(
      roleHasPermission(
        MembershipRole.MEMBER,
        OrganizationPermission.MEMBERS_REMOVE,
      ),
    ).toBe(false);
  });

  it('membership removido não tem permissão nenhuma', () => {
    const membership = Membership.createOwner('org-1', 'user-1');
    membership.remove();

    expect(membership.can(OrganizationPermission.MEMBERS_READ)).toBe(false);
  });
});

describe('Acesso a organizações', () => {
  beforeEach(async () => {
    memberships = new InMemoryMembershipRepository();
    organizations = new InMemoryOrganizationRepository(memberships);
    access = new OrganizationAccessService(organizations, memberships);

    const users = new FakeUserDirectory();
    for (const user of [OWNER, MEMBER, OUTSIDER])
      users.register(user.sub, user.id);
    updateOrganization = new UpdateOrganizationUseCase(
      organizations,
      users,
      access,
    );

    organization = Organization.create({ name: 'Acme', slug: 'acme' });
    await organizations.createWithOwner(
      organization,
      Membership.createOwner(organization.id, OWNER.id),
    );
    memberships.items.push(
      Membership.create({
        organizationId: organization.id,
        userId: MEMBER.id,
        role: MembershipRole.MEMBER,
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

    it('nega membro sem a permissão com FORBIDDEN', async () => {
      await expect(
        access.requirePermission(
          organization.id,
          MEMBER.id,
          OrganizationPermission.ORGANIZATIONS_UPDATE,
        ),
      ).rejects.toBeInstanceOf(OrganizationPermissionDeniedError);
    });

    it('não membro recebe NOT_FOUND, mesmo pedindo permissão', async () => {
      await expect(
        access.requirePermission(
          organization.id,
          OUTSIDER.id,
          OrganizationPermission.MEMBERS_READ,
        ),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
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
