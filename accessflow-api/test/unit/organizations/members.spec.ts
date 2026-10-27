import { beforeEach, describe, expect, it } from 'vitest';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import {
  Membership,
  MembershipStatus,
} from '@/modules/organizations/domain/entities/membership.entity';
import { RoleSystemKey } from '@/modules/organizations/domain/entities/role.entity';
import { OrganizationAccessService } from '@/modules/organizations/application/services/organization-access.service';
import { ListOrganizationMembersUseCase } from '@/modules/organizations/application/use-cases/list-organization-members.use-case';
import { RemoveMemberUseCase } from '@/modules/organizations/application/use-cases/remove-member.use-case';
import { LeaveOrganizationUseCase } from '@/modules/organizations/application/use-cases/leave-organization.use-case';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { OrganizationPermissionDeniedError } from '@/modules/organizations/domain/errors/organization-permission-denied.error';
import { CannotRemoveSelfError } from '@/modules/organizations/domain/errors/cannot-remove-self.error';
import { MemberNotFoundError } from '@/modules/organizations/domain/errors/member-not-found.error';
import { LastOwnerError } from '@/modules/organizations/domain/errors/last-owner.error';
import { InMemoryOrganizationRepository } from '@test/in-memory/organizations/in-memory-organization-repository';
import { InMemoryMembershipRepository } from '@test/in-memory/organizations/in-memory-membership-repository';
import { InMemoryRoleRepository } from '@test/in-memory/organizations/in-memory-role-repository';
import { FakeUserDirectory } from '@test/fakes/organizations/fake-user-directory';
import { FakeTransactionManager } from '@test/fakes/shared/fake-transaction-manager';
import { FixedClock } from '@test/fakes/shared/fixed-clock';

const OWNER = { sub: 'sub-owner', id: '11111111-1111-4111-8111-111111111111' };
const MEMBER = {
  sub: 'sub-member',
  id: '22222222-2222-4222-8222-222222222222',
};
const OUTSIDER = {
  sub: 'sub-outsider',
  id: '33333333-3333-4333-8333-333333333333',
};
const SECOND_OWNER = {
  sub: 'sub-owner-2',
  id: '44444444-4444-4444-8444-444444444444',
};

let roles: InMemoryRoleRepository;
let memberships: InMemoryMembershipRepository;
let organizations: InMemoryOrganizationRepository;
let users: FakeUserDirectory;
let listMembers: ListOrganizationMembersUseCase;
let removeMember: RemoveMemberUseCase;
let leaveOrganization: LeaveOrganizationUseCase;
let organization: Organization;

function addMember(userId: string, role: RoleSystemKey, now: Date): Membership {
  const membership = Membership.create(
    {
      organizationId: organization.id,
      userId,
      roleId: roles.systemRole(organization.id, role).id,
    },
    now,
  );
  memberships.items.push(membership);
  return membership;
}

function membershipOf(userId: string): Membership | undefined {
  return memberships.items.find(
    (m) => m.organizationId === organization.id && m.userId === userId,
  );
}

describe('Membros da organização', () => {
  beforeEach(async () => {
    roles = new InMemoryRoleRepository();
    memberships = new InMemoryMembershipRepository(roles);
    organizations = new InMemoryOrganizationRepository();
    users = new FakeUserDirectory();
    users.register(OWNER.sub, OWNER.id, {
      name: 'Olga',
      email: 'olga@example.com',
    });
    users.register(MEMBER.sub, MEMBER.id, {
      name: 'Mário',
      email: 'mario@example.com',
    });
    users.register(OUTSIDER.sub, OUTSIDER.id);
    users.register(SECOND_OWNER.sub, SECOND_OWNER.id);

    const clock = new FixedClock();
    const access = new OrganizationAccessService(
      organizations,
      memberships,
      roles,
    );
    listMembers = new ListOrganizationMembersUseCase(
      memberships,
      roles,
      users,
      access,
    );
    removeMember = new RemoveMemberUseCase(
      organizations,
      memberships,
      users,
      access,
      new FakeTransactionManager(),
      clock,
    );
    leaveOrganization = new LeaveOrganizationUseCase(
      memberships,
      users,
      access,
      clock,
    );

    organization = Organization.create({ name: 'Acme', slug: 'acme' });
    await organizations.create(organization);
    roles.seedDefaults(organization.id);
    addMember(OWNER.id, RoleSystemKey.OWNER, new Date('2026-01-01T00:00:00Z'));
    addMember(
      MEMBER.id,
      RoleSystemKey.MEMBER,
      new Date('2026-01-02T00:00:00Z'),
    );
  });

  describe('ListOrganizationMembersUseCase', () => {
    it('lista os membros com nome e e-mail, do mais antigo ao mais novo', async () => {
      const page = await listMembers.execute({
        cognitoSub: MEMBER.sub,
        organizationId: organization.id,
        first: 20,
      });

      expect(
        page.items.map(({ membership, profile, role }) => ({
          userId: membership.userId,
          role: role.systemKey,
          name: profile.name,
          email: profile.email,
        })),
      ).toEqual([
        {
          userId: OWNER.id,
          role: RoleSystemKey.OWNER,
          name: 'Olga',
          email: 'olga@example.com',
        },
        {
          userId: MEMBER.id,
          role: RoleSystemKey.MEMBER,
          name: 'Mário',
          email: 'mario@example.com',
        },
      ]);
      expect(page.hasNextPage).toBe(false);
    });

    it('pagina em duas páginas sem repetir nem pular', async () => {
      // Três membros com o mesmo createdAt: o id desempata a ordem.
      const sameTime = new Date('2026-01-03T00:00:00Z');
      for (const n of [5, 6, 7]) {
        const id = `${n}${n}${n}${n}${n}${n}${n}${n}-0000-4000-8000-000000000000`;
        users.register(`sub-${n}`, id);
        addMember(id, RoleSystemKey.MEMBER, sameTime);
      }
      addMember(
        OUTSIDER.id,
        RoleSystemKey.MEMBER,
        new Date('2026-01-04T00:00:00Z'),
      ).remove();

      const all = await listMembers.execute({
        cognitoSub: OWNER.sub,
        organizationId: organization.id,
        first: 50,
      });
      const first = await listMembers.execute({
        cognitoSub: OWNER.sub,
        organizationId: organization.id,
        first: 3,
      });
      const last = first.items.at(-1)!.membership;
      const second = await listMembers.execute({
        cognitoSub: OWNER.sub,
        organizationId: organization.id,
        first: 3,
        after: { createdAt: last.createdAt, id: last.id },
      });

      expect(first.hasNextPage).toBe(true);
      expect(second.hasNextPage).toBe(false);
      expect(
        [...first.items, ...second.items].map((i) => i.membership.id),
      ).toEqual(all.items.map((i) => i.membership.id));
      expect(all.items).toHaveLength(5);
    });

    it('responde NOT_FOUND para quem não é membro', async () => {
      await expect(
        listMembers.execute({
          cognitoSub: OUTSIDER.sub,
          organizationId: organization.id,
          first: 20,
        }),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });
  });

  describe('RemoveMemberUseCase', () => {
    it('OWNER remove MEMBER', async () => {
      await removeMember.execute({
        cognitoSub: OWNER.sub,
        organizationId: organization.id,
        userId: MEMBER.id,
      });

      expect(membershipOf(MEMBER.id)?.status).toBe(MembershipStatus.REMOVED);
    });

    it('MEMBER não pode remover (FORBIDDEN)', async () => {
      await expect(
        removeMember.execute({
          cognitoSub: MEMBER.sub,
          organizationId: organization.id,
          userId: OWNER.id,
        }),
      ).rejects.toBeInstanceOf(OrganizationPermissionDeniedError);

      expect(membershipOf(OWNER.id)?.isActive()).toBe(true);
    });

    it('checa a permissão do autor antes de olhar o alvo', async () => {
      await expect(
        removeMember.execute({
          cognitoSub: MEMBER.sub,
          organizationId: organization.id,
          userId: 'nao-e-uuid',
        }),
      ).rejects.toBeInstanceOf(OrganizationPermissionDeniedError);
    });

    it('não membro recebe NOT_FOUND da organização', async () => {
      await expect(
        removeMember.execute({
          cognitoSub: OUTSIDER.sub,
          organizationId: organization.id,
          userId: MEMBER.id,
        }),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });

    it.each([
      ['o próprio id', OWNER.id],
      ['o próprio id em maiúsculas', OWNER.id.toUpperCase()],
    ])('recusa remover a si mesmo (%s)', async (_cenario, userId) => {
      await expect(
        removeMember.execute({
          cognitoSub: OWNER.sub,
          organizationId: organization.id,
          userId,
        }),
      ).rejects.toBeInstanceOf(CannotRemoveSelfError);

      expect(membershipOf(OWNER.id)?.isActive()).toBe(true);
    });

    it.each([
      ['alvo que não é membro', OUTSIDER.id],
      ['id malformado', 'nao-e-uuid'],
    ])('responde MemberNotFoundError para %s', async (_cenario, userId) => {
      await expect(
        removeMember.execute({
          cognitoSub: OWNER.sub,
          organizationId: organization.id,
          userId,
        }),
      ).rejects.toBeInstanceOf(MemberNotFoundError);
    });

    it('responde MemberNotFoundError para membro já removido', async () => {
      membershipOf(MEMBER.id)?.remove();

      await expect(
        removeMember.execute({
          cognitoSub: OWNER.sub,
          organizationId: organization.id,
          userId: MEMBER.id,
        }),
      ).rejects.toBeInstanceOf(MemberNotFoundError);
    });
  });

  describe('LeaveOrganizationUseCase', () => {
    it('MEMBER sai e depois recebe NOT_FOUND', async () => {
      await leaveOrganization.execute({
        cognitoSub: MEMBER.sub,
        organizationId: organization.id,
      });

      expect(membershipOf(MEMBER.id)?.status).toBe(MembershipStatus.REMOVED);
      await expect(
        listMembers.execute({
          cognitoSub: MEMBER.sub,
          organizationId: organization.id,
          first: 20,
        }),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });

    it('o último OWNER não pode sair', async () => {
      await expect(
        leaveOrganization.execute({
          cognitoSub: OWNER.sub,
          organizationId: organization.id,
        }),
      ).rejects.toBeInstanceOf(LastOwnerError);

      expect(membershipOf(OWNER.id)?.isActive()).toBe(true);
    });

    it('OWNER sai quando existe outro OWNER', async () => {
      addMember(
        SECOND_OWNER.id,
        RoleSystemKey.OWNER,
        new Date('2026-01-05T00:00:00Z'),
      );

      await leaveOrganization.execute({
        cognitoSub: OWNER.sub,
        organizationId: organization.id,
      });

      expect(membershipOf(OWNER.id)?.status).toBe(MembershipStatus.REMOVED);
      expect(membershipOf(SECOND_OWNER.id)).toMatchObject({
        status: MembershipStatus.ACTIVE,
        roleId: roles.systemRole(organization.id, RoleSystemKey.OWNER).id,
      });
    });

    it('não membro recebe NOT_FOUND', async () => {
      await expect(
        leaveOrganization.execute({
          cognitoSub: OUTSIDER.sub,
          organizationId: organization.id,
        }),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });
  });
});
