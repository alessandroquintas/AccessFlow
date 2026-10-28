import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { Role } from '@/modules/organizations/domain/entities/role.entity';
import { Invitation } from '@/modules/organizations/domain/entities/invitation.entity';
import { CustomPermission } from '@/modules/organizations/domain/entities/custom-permission.entity';
import {
  AuditAction,
  AuditEvent,
} from '@/modules/organizations/domain/entities/audit-event.entity';
import {
  OrganizationPermission,
  PermissionCatalog,
} from '@/modules/organizations/policies/organization-permission';
import { OrganizationAccessService } from '@/modules/organizations/application/services/organization-access.service';
import { CreateOrganizationUseCase } from '@/modules/organizations/application/use-cases/create-organization.use-case';
import { UpdateOrganizationUseCase } from '@/modules/organizations/application/use-cases/update-organization.use-case';
import { RemoveMemberUseCase } from '@/modules/organizations/application/use-cases/remove-member.use-case';
import { LeaveOrganizationUseCase } from '@/modules/organizations/application/use-cases/leave-organization.use-case';
import { AssignRoleUseCase } from '@/modules/organizations/application/use-cases/assign-role.use-case';
import { InviteMemberUseCase } from '@/modules/organizations/application/use-cases/invite-member.use-case';
import { RevokeInvitationUseCase } from '@/modules/organizations/application/use-cases/revoke-invitation.use-case';
import { AcceptInvitationUseCase } from '@/modules/organizations/application/use-cases/accept-invitation.use-case';
import { DeclineInvitationUseCase } from '@/modules/organizations/application/use-cases/decline-invitation.use-case';
import { CreateRoleUseCase } from '@/modules/organizations/application/use-cases/create-role.use-case';
import { UpdateRoleUseCase } from '@/modules/organizations/application/use-cases/update-role.use-case';
import { DeleteRoleUseCase } from '@/modules/organizations/application/use-cases/delete-role.use-case';
import { CreatePermissionUseCase } from '@/modules/organizations/application/use-cases/create-permission.use-case';
import { UpdatePermissionUseCase } from '@/modules/organizations/application/use-cases/update-permission.use-case';
import { DeletePermissionUseCase } from '@/modules/organizations/application/use-cases/delete-permission.use-case';
import { InMemoryOrganizationRepository } from '@test/in-memory/organizations/in-memory-organization-repository';
import { InMemoryMembershipRepository } from '@test/in-memory/organizations/in-memory-membership-repository';
import { InMemoryRoleRepository } from '@test/in-memory/organizations/in-memory-role-repository';
import { InMemoryInvitationRepository } from '@test/in-memory/organizations/in-memory-invitation-repository';
import { InMemoryCustomPermissionRepository } from '@test/in-memory/organizations/in-memory-custom-permission-repository';
import { InMemoryAuditLog } from '@test/in-memory/organizations/in-memory-audit-log';
import { FakeUserDirectory } from '@test/fakes/organizations/fake-user-directory';
import { FakeTransactionManager } from '@test/fakes/shared/fake-transaction-manager';
import { FixedClock } from '@test/fakes/shared/fixed-clock';

const START = new Date('2026-03-01T12:00:00.000Z');
const NOW = new Date('2026-03-02T12:00:00.000Z');
const { MEMBERS_READ, MEMBERS_INVITE, ROLES_READ } = OrganizationPermission;

const OWNER = {
  sub: 'sub-owner',
  id: '11111111-1111-4111-8111-111111111111',
  email: 'olga@example.com',
};
const MEMBER = {
  sub: 'sub-member',
  id: '22222222-2222-4222-8222-222222222222',
  email: 'mario@example.com',
};
const INVITEE = {
  sub: 'sub-bruno',
  id: '33333333-3333-4333-8333-333333333333',
  email: 'bruno@example.com',
};

let roles: InMemoryRoleRepository;
let memberships: InMemoryMembershipRepository;
let organizations: InMemoryOrganizationRepository;
let invitations: InMemoryInvitationRepository;
let customPermissions: InMemoryCustomPermissionRepository;
let audit: InMemoryAuditLog;
let acme: Organization;
let ownerRole: Role;
let memberRole: Role;
let uc: ReturnType<typeof buildUseCases>;

function buildUseCases(users: FakeUserDirectory, clock: FixedClock) {
  const tx = new FakeTransactionManager();
  const access = new OrganizationAccessService(
    organizations,
    memberships,
    roles,
  );
  return {
    createOrganization: new CreateOrganizationUseCase(
      organizations,
      roles,
      memberships,
      users,
      audit,
      tx,
      clock,
    ),
    updateOrganization: new UpdateOrganizationUseCase(
      organizations,
      users,
      access,
      audit,
      tx,
      clock,
    ),
    removeMember: new RemoveMemberUseCase(
      organizations,
      memberships,
      users,
      access,
      audit,
      tx,
      clock,
    ),
    leaveOrganization: new LeaveOrganizationUseCase(
      organizations,
      memberships,
      users,
      access,
      audit,
      tx,
      clock,
    ),
    assignRole: new AssignRoleUseCase(
      organizations,
      memberships,
      roles,
      users,
      access,
      audit,
      tx,
      clock,
    ),
    inviteMember: new InviteMemberUseCase(
      organizations,
      invitations,
      memberships,
      roles,
      users,
      access,
      audit,
      tx,
      clock,
    ),
    revokeInvitation: new RevokeInvitationUseCase(
      organizations,
      invitations,
      users,
      access,
      audit,
      tx,
      clock,
    ),
    acceptInvitation: new AcceptInvitationUseCase(
      invitations,
      organizations,
      roles,
      memberships,
      users,
      audit,
      tx,
      clock,
    ),
    declineInvitation: new DeclineInvitationUseCase(
      invitations,
      organizations,
      users,
      audit,
      tx,
      clock,
    ),
    createRole: new CreateRoleUseCase(
      organizations,
      roles,
      customPermissions,
      users,
      access,
      audit,
      tx,
      clock,
    ),
    updateRole: new UpdateRoleUseCase(
      organizations,
      roles,
      memberships,
      customPermissions,
      users,
      access,
      audit,
      tx,
      clock,
    ),
    deleteRole: new DeleteRoleUseCase(
      organizations,
      roles,
      users,
      access,
      audit,
      tx,
      clock,
    ),
    createPermission: new CreatePermissionUseCase(
      organizations,
      customPermissions,
      users,
      access,
      audit,
      tx,
      clock,
    ),
    updatePermission: new UpdatePermissionUseCase(
      organizations,
      customPermissions,
      users,
      access,
      audit,
      tx,
      clock,
    ),
    deletePermission: new DeletePermissionUseCase(
      organizations,
      customPermissions,
      users,
      access,
      audit,
      tx,
      clock,
    ),
  };
}

function addMember(userId: string, role: Role): Membership {
  const membership = Membership.create(
    { organizationId: acme.id, userId, roleId: role.id },
    START,
  );
  memberships.items.push(membership);
  return membership;
}

function seedRole(name: string, permissions: string[]): Role {
  const role = Role.create(
    { organizationId: acme.id, name, permissions },
    PermissionCatalog.withCustom(customPermissions.items.map((p) => p.key)),
    START,
  );
  roles.seed(role);
  return role;
}

function seedPermission(key: string, description = 'Aprovar faturas') {
  customPermissions.seed(
    CustomPermission.create(
      { organizationId: acme.id, key, description },
      START,
    ),
  );
}

function seedInvitation(roleId: string, email = INVITEE.email): Invitation {
  const invitation = Invitation.create(
    { organizationId: acme.id, email, roleId, invitedByUserId: OWNER.id },
    START,
  );
  invitations.seed(invitation);
  return invitation;
}

/** O único evento gravado; falha se houver zero ou mais de um. */
function onlyEvent(): AuditEvent {
  expect(audit.items).toHaveLength(1);
  return audit.items[0];
}

function by(user: { id: string }) {
  return { type: 'USER', userId: user.id };
}

describe('Trilha de auditoria dos casos de uso', () => {
  beforeEach(() => {
    roles = new InMemoryRoleRepository(() => ({
      memberships: memberships.items,
      invitations: invitations.items,
    }));
    memberships = new InMemoryMembershipRepository(roles);
    organizations = new InMemoryOrganizationRepository();
    invitations = new InMemoryInvitationRepository(memberships);
    customPermissions = new InMemoryCustomPermissionRepository(roles);
    audit = new InMemoryAuditLog();
    const users = new FakeUserDirectory();
    for (const user of [OWNER, MEMBER, INVITEE]) {
      users.register(user.sub, user.id, { email: user.email });
    }
    uc = buildUseCases(users, new FixedClock(NOW));

    acme = Organization.create({ name: 'Acme', slug: 'acme' }, START);
    organizations.items.push(acme);
    ({ owner: ownerRole, member: memberRole } = roles.seedDefaults(
      acme.id,
      START,
    ));
    addMember(OWNER.id, ownerRole);
    addMember(MEMBER.id, memberRole);
  });

  afterEach(() => {
    // Varredura: nenhum details gravado pode ter e-mail.
    expect(
      audit.items.filter((e) => JSON.stringify(e.details).includes('@')),
    ).toEqual([]);
  });

  const as = (user: { sub: string }) => ({
    cognitoSub: user.sub,
    organizationId: acme.id,
  });

  describe('organização', () => {
    it('createOrganization: organization.created com nome e slug', async () => {
      const { organization } = await uc.createOrganization.execute({
        cognitoSub: OWNER.sub,
        name: 'Beta',
        slug: 'beta',
      });

      expect(onlyEvent()).toMatchObject({
        organizationId: organization.id,
        actor: by(OWNER),
        action: AuditAction.ORGANIZATION_CREATED,
        target: { type: 'organization', id: organization.id },
        details: { name: 'Beta', slug: 'beta' },
        occurredAt: NOW,
      });
    });

    it('createOrganization com slug repetido: nenhum evento', async () => {
      await expect(
        uc.createOrganization.execute({
          cognitoSub: OWNER.sub,
          name: 'Outra',
          slug: 'acme',
        }),
      ).rejects.toThrow();
      expect(audit.items).toEqual([]);
    });

    it('updateOrganization: só o campo que mudou; o mesmo nome não grava nada', async () => {
      await uc.updateOrganization.execute({ ...as(OWNER), name: '  Acme  ' });
      expect(audit.items).toEqual([]);
      expect(acme.updatedAt).toEqual(START);

      await uc.updateOrganization.execute({ ...as(OWNER), name: 'Acme SA' });

      expect(onlyEvent()).toMatchObject({
        action: AuditAction.ORGANIZATION_UPDATED,
        target: { type: 'organization', id: acme.id },
        details: { changes: { name: { from: 'Acme', to: 'Acme SA' } } },
      });
    });

    it('updateOrganization sem permissão: nenhum evento', async () => {
      await expect(
        uc.updateOrganization.execute({ ...as(MEMBER), name: 'Outra' }),
      ).rejects.toThrow();
      expect(audit.items).toEqual([]);
    });
  });

  describe('membros', () => {
    it('removeMember: member.removed com o papel do removido', async () => {
      await uc.removeMember.execute({
        cognitoSub: OWNER.sub,
        organizationId: acme.id,
        userId: MEMBER.id,
      });

      expect(onlyEvent()).toMatchObject({
        organizationId: acme.id,
        actor: by(OWNER),
        action: AuditAction.MEMBER_REMOVED,
        target: { type: 'member', id: MEMBER.id },
        details: { roleId: memberRole.id },
      });
    });

    it('removeMember que falha (a si mesmo, não membro): nenhum evento', async () => {
      for (const userId of [OWNER.id, INVITEE.id]) {
        await expect(
          uc.removeMember.execute({ ...as(OWNER), userId }),
        ).rejects.toThrow();
      }
      expect(audit.items).toEqual([]);
    });

    it('leaveOrganization: member.left, com o próprio usuário como ator e alvo', async () => {
      await uc.leaveOrganization.execute(as(MEMBER));

      expect(onlyEvent()).toMatchObject({
        actor: by(MEMBER),
        action: AuditAction.MEMBER_LEFT,
        target: { type: 'member', id: MEMBER.id },
        details: { roleId: memberRole.id },
      });
    });

    it('leaveOrganization do último OWNER: nenhum evento', async () => {
      await expect(uc.leaveOrganization.execute(as(OWNER))).rejects.toThrow();
      expect(audit.items).toEqual([]);
    });

    it('assignRole: member.role_changed com de e para; o mesmo papel não grava nada', async () => {
      const finance = seedRole('Financeiro', [MEMBERS_READ]);

      await uc.assignRole.execute({
        ...as(OWNER),
        userId: MEMBER.id,
        roleId: memberRole.id,
      });
      expect(audit.items).toEqual([]);

      await uc.assignRole.execute({
        ...as(OWNER),
        userId: MEMBER.id,
        roleId: finance.id,
      });

      expect(onlyEvent()).toMatchObject({
        action: AuditAction.MEMBER_ROLE_CHANGED,
        target: { type: 'member', id: MEMBER.id },
        details: { fromRoleId: memberRole.id, toRoleId: finance.id },
      });
    });

    it('assignRole que falha (último OWNER): nenhum evento', async () => {
      await expect(
        uc.assignRole.execute({
          ...as(OWNER),
          userId: OWNER.id,
          roleId: memberRole.id,
        }),
      ).rejects.toThrow();
      expect(audit.items).toEqual([]);
    });
  });

  describe('convites', () => {
    function invite(roleId: string, email = INVITEE.email) {
      return uc.inviteMember.execute({ ...as(OWNER), email, roleId });
    }

    it('inviteMember: invitation.created com o papel', async () => {
      const { invitation } = await invite(memberRole.id);

      expect(onlyEvent()).toMatchObject({
        action: AuditAction.INVITATION_CREATED,
        target: { type: 'invitation', id: invitation.id },
        details: { roleId: memberRole.id },
      });
    });

    it('reconvite: invitation.renewed; previousRoleId só quando o papel muda', async () => {
      const { invitation } = await invite(memberRole.id);
      const finance = seedRole('Financeiro', [MEMBERS_READ]);

      await invite(memberRole.id);
      await invite(finance.id);

      const [, sameRole, otherRole] = audit.items;
      expect(audit.items).toHaveLength(3);
      expect(sameRole).toMatchObject({
        action: AuditAction.INVITATION_RENEWED,
        target: { id: invitation.id },
      });
      expect(sameRole.details).toEqual({ roleId: memberRole.id });
      expect(otherRole.details).toEqual({
        roleId: finance.id,
        previousRoleId: memberRole.id,
      });
    });

    it('inviteMember que falha (já é membro): nenhum evento', async () => {
      await expect(invite(memberRole.id, MEMBER.email)).rejects.toThrow();
      expect(audit.items).toEqual([]);
    });

    it('revokeInvitation: invitation.revoked; convite inexistente, nenhum evento', async () => {
      const invitation = seedInvitation(memberRole.id);

      await expect(
        uc.revokeInvitation.execute({
          ...as(OWNER),
          invitationId: crypto.randomUUID(),
        }),
      ).rejects.toThrow();
      expect(audit.items).toEqual([]);

      await uc.revokeInvitation.execute({
        ...as(OWNER),
        invitationId: invitation.id,
      });
      expect(onlyEvent()).toMatchObject({
        action: AuditAction.INVITATION_REVOKED,
        target: { type: 'invitation', id: invitation.id },
        details: {},
      });
    });

    describe('acceptInvitation: o ator é o convidado; roleId é o papel depois do aceite', () => {
      const accept = (invitation: Invitation) =>
        uc.acceptInvitation.execute({
          cognitoSub: INVITEE.sub,
          invitationId: invitation.id,
        });

      it('membership criado', async () => {
        const invitation = seedInvitation(ownerRole.id);

        await accept(invitation);

        expect(onlyEvent()).toMatchObject({
          actor: by(INVITEE),
          action: AuditAction.INVITATION_ACCEPTED,
          target: { type: 'invitation', id: invitation.id },
          details: {
            roleId: ownerRole.id,
            memberUserId: INVITEE.id,
            membership: 'created',
          },
        });
      });

      it('membership REMOVED reativado com o papel do convite', async () => {
        addMember(INVITEE.id, ownerRole).remove(START);
        const invitation = seedInvitation(memberRole.id);

        await accept(invitation);

        expect(onlyEvent().details).toEqual({
          roleId: memberRole.id,
          memberUserId: INVITEE.id,
          membership: 'reactivated',
        });
      });

      it('já era membro ativo: o papel não muda e é ele que vai no roleId', async () => {
        addMember(INVITEE.id, ownerRole);
        const invitation = seedInvitation(memberRole.id);

        await accept(invitation);

        expect(onlyEvent().details).toEqual({
          roleId: ownerRole.id,
          memberUserId: INVITEE.id,
          membership: 'unchanged',
        });
      });

      it('convite de outra pessoa: nenhum evento', async () => {
        const invitation = seedInvitation(memberRole.id, 'outra@example.com');

        await expect(accept(invitation)).rejects.toThrow();
        expect(audit.items).toEqual([]);
      });
    });

    it('declineInvitation: invitation.declined pelo convidado; de outra pessoa, nenhum evento', async () => {
      const mine = seedInvitation(memberRole.id);
      const other = seedInvitation(memberRole.id, 'outra@example.com');
      const decline = (invitationId: string) =>
        uc.declineInvitation.execute({ cognitoSub: INVITEE.sub, invitationId });

      await expect(decline(other.id)).rejects.toThrow();
      expect(audit.items).toEqual([]);

      await decline(mine.id);
      expect(onlyEvent()).toMatchObject({
        organizationId: acme.id,
        actor: by(INVITEE),
        action: AuditAction.INVITATION_DECLINED,
        target: { type: 'invitation', id: mine.id },
        details: {},
      });
    });
  });

  describe('papéis', () => {
    it('createRole: role.created com nome e permissões; nome repetido, nenhum evento', async () => {
      const { role } = await uc.createRole.execute({
        ...as(OWNER),
        name: 'Financeiro',
        permissions: [ROLES_READ, MEMBERS_READ],
      });
      await expect(
        uc.createRole.execute({
          ...as(OWNER),
          name: 'financeiro',
          permissions: [],
        }),
      ).rejects.toThrow();

      expect(onlyEvent()).toMatchObject({
        action: AuditAction.ROLE_CREATED,
        target: { type: 'role', id: role.id },
        details: {
          name: 'Financeiro',
          permissions: [MEMBERS_READ, ROLES_READ],
        },
      });
    });

    it('updateRole: um evento com só o que mudou; nada mudou, nenhum evento', async () => {
      const finance = seedRole('Financeiro', [MEMBERS_READ, ROLES_READ]);
      const update = (changes: { name?: string; permissions?: string[] }) =>
        uc.updateRole.execute({ ...as(OWNER), roleId: finance.id, ...changes });

      await update({
        name: ' Financeiro ',
        permissions: [ROLES_READ, MEMBERS_READ],
      });
      expect(audit.items).toEqual([]);

      await update({
        name: 'Contas',
        permissions: [MEMBERS_READ, MEMBERS_INVITE],
      });
      expect(onlyEvent()).toMatchObject({
        action: AuditAction.ROLE_UPDATED,
        target: { type: 'role', id: finance.id },
        details: {
          changes: {
            name: { from: 'Financeiro', to: 'Contas' },
            permissionsAdded: [MEMBERS_INVITE],
            permissionsRemoved: [ROLES_READ],
          },
        },
      });

      await update({ permissions: [MEMBERS_READ] });
      expect(audit.items[1].details).toEqual({
        changes: { permissionsRemoved: [MEMBERS_INVITE] },
      });
    });

    it('updateRole que falha (papel de sistema): nenhum evento', async () => {
      await expect(
        uc.updateRole.execute({
          ...as(OWNER),
          roleId: ownerRole.id,
          name: 'Dono',
        }),
      ).rejects.toThrow();
      expect(audit.items).toEqual([]);
    });

    it('deleteRole: role.deleted com o nome; em uso, nenhum evento', async () => {
      const finance = seedRole('Financeiro', []);
      await expect(
        uc.deleteRole.execute({ ...as(OWNER), roleId: memberRole.id }),
      ).rejects.toThrow();

      await uc.deleteRole.execute({ ...as(OWNER), roleId: finance.id });

      expect(onlyEvent()).toMatchObject({
        action: AuditAction.ROLE_DELETED,
        target: { type: 'role', id: finance.id },
        details: { name: 'Financeiro' },
      });
    });
  });

  describe('permissões personalizadas (o alvo é a chave)', () => {
    it('createPermission: permission.created; recurso reservado, nenhum evento', async () => {
      await expect(
        uc.createPermission.execute({
          ...as(OWNER),
          key: 'roles:approve',
          description: 'X',
        }),
      ).rejects.toThrow();

      await uc.createPermission.execute({
        ...as(OWNER),
        key: 'invoices:approve',
        description: ' Aprovar  faturas ',
      });

      expect(onlyEvent()).toMatchObject({
        action: AuditAction.PERMISSION_CREATED,
        target: { type: 'permission', id: 'invoices:approve' },
        details: { key: 'invoices:approve', description: 'Aprovar faturas' },
      });
    });

    it('updatePermission: só com descrição nova', async () => {
      seedPermission('invoices:approve');
      const update = (description: string) =>
        uc.updatePermission.execute({
          ...as(OWNER),
          key: 'invoices:approve',
          description,
        });

      await update(' Aprovar faturas ');
      expect(audit.items).toEqual([]);

      await update('Aprovar notas');
      expect(onlyEvent()).toMatchObject({
        action: AuditAction.PERMISSION_UPDATED,
        target: { type: 'permission', id: 'invoices:approve' },
        details: {
          changes: {
            description: { from: 'Aprovar faturas', to: 'Aprovar notas' },
          },
        },
      });
    });

    it('deletePermission: permission.deleted; em uso, nenhum evento', async () => {
      seedPermission('invoices:approve');
      const finance = seedRole('Financeiro', ['invoices:approve']);
      const remove = () =>
        uc.deletePermission.execute({ ...as(OWNER), key: 'invoices:approve' });

      await expect(remove()).rejects.toThrow();
      expect(audit.items).toEqual([]);

      roles.revoke(finance.id, 'invoices:approve');
      await remove();
      expect(onlyEvent()).toMatchObject({
        action: AuditAction.PERMISSION_DELETED,
        target: { type: 'permission', id: 'invoices:approve' },
        details: { key: 'invoices:approve' },
        occurredAt: NOW,
      });
    });
  });
});
