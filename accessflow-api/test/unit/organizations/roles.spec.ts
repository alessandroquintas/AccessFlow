import { beforeEach, describe, expect, it } from 'vitest';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { Invitation } from '@/modules/organizations/domain/entities/invitation.entity';
import {
  Role,
  RoleSystemKey,
} from '@/modules/organizations/domain/entities/role.entity';
import {
  OrganizationPermission,
  PermissionCatalog,
} from '@/modules/organizations/policies/organization-permission';
import { OrganizationAccessService } from '@/modules/organizations/application/services/organization-access.service';
import { CreateRoleUseCase } from '@/modules/organizations/application/use-cases/create-role.use-case';
import { UpdateRoleUseCase } from '@/modules/organizations/application/use-cases/update-role.use-case';
import { DeleteRoleUseCase } from '@/modules/organizations/application/use-cases/delete-role.use-case';
import { AssignRoleUseCase } from '@/modules/organizations/application/use-cases/assign-role.use-case';
import { ListOrganizationRolesUseCase } from '@/modules/organizations/application/use-cases/list-organization-roles.use-case';
import { GetMyPermissionsUseCase } from '@/modules/organizations/application/use-cases/get-my-permissions.use-case';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { OrganizationPermissionDeniedError } from '@/modules/organizations/domain/errors/organization-permission-denied.error';
import { PrivilegeEscalationError } from '@/modules/organizations/domain/errors/privilege-escalation.error';
import { InvalidPermissionError } from '@/modules/organizations/domain/errors/invalid-permission.error';
import { InvalidRoleError } from '@/modules/organizations/domain/errors/invalid-role.error';
import { RoleNameTakenError } from '@/modules/organizations/domain/errors/role-name-taken.error';
import { RoleLimitReachedError } from '@/modules/organizations/domain/errors/role-limit-reached.error';
import { SystemRoleImmutableError } from '@/modules/organizations/domain/errors/system-role-immutable.error';
import { RoleInUseError } from '@/modules/organizations/domain/errors/role-in-use.error';
import { RoleNotFoundError } from '@/modules/organizations/domain/errors/role-not-found.error';
import { MemberNotFoundError } from '@/modules/organizations/domain/errors/member-not-found.error';
import { LastOwnerError } from '@/modules/organizations/domain/errors/last-owner.error';
import { InMemoryOrganizationRepository } from '@test/in-memory/organizations/in-memory-organization-repository';
import { InMemoryMembershipRepository } from '@test/in-memory/organizations/in-memory-membership-repository';
import { InMemoryRoleRepository } from '@test/in-memory/organizations/in-memory-role-repository';
import { InMemoryInvitationRepository } from '@test/in-memory/organizations/in-memory-invitation-repository';
import { InMemoryCustomPermissionRepository } from '@test/in-memory/organizations/in-memory-custom-permission-repository';
import { CustomPermission } from '@/modules/organizations/domain/entities/custom-permission.entity';
import { FakeUserDirectory } from '@test/fakes/organizations/fake-user-directory';
import { FakeTransactionManager } from '@test/fakes/shared/fake-transaction-manager';
import { FixedClock } from '@test/fakes/shared/fixed-clock';
import { InMemoryAuditLog } from '@test/in-memory/organizations/in-memory-audit-log';

const START = new Date('2026-03-01T12:00:00.000Z');
const LATER = new Date('2026-03-02T12:00:00.000Z');
const MISSING_ID = '55555555-5555-4555-8555-555555555555';
const {
  ORGANIZATIONS_UPDATE,
  MEMBERS_READ,
  MEMBERS_INVITE,
  MEMBERS_REMOVE,
  ROLES_READ,
  ROLES_MANAGE,
  ROLES_ASSIGN,
} = OrganizationPermission;

const OWNER = { sub: 'sub-owner', id: '11111111-1111-4111-8111-111111111111' };
const MEMBER = {
  sub: 'sub-member',
  id: '22222222-2222-4222-8222-222222222222',
};
const BRUNO = { sub: 'sub-bruno', id: '33333333-3333-4333-8333-333333333333' };
const OUTSIDER = {
  sub: 'sub-outsider',
  id: '44444444-4444-4444-8444-444444444444',
};

let clock: FixedClock;
let roles: InMemoryRoleRepository;
let memberships: InMemoryMembershipRepository;
let invitations: InMemoryInvitationRepository;
let organizations: InMemoryOrganizationRepository;
let customPermissions: InMemoryCustomPermissionRepository;
let createRole: CreateRoleUseCase;
let updateRole: UpdateRoleUseCase;
let deleteRole: DeleteRoleUseCase;
let assignRole: AssignRoleUseCase;
let listRoles: ListOrganizationRolesUseCase;
let getMyPermissions: GetMyPermissionsUseCase;
let acme: Organization;
let ownerRole: Role;
let memberRole: Role;

function createOrganization(slug: string): Organization {
  const organization = Organization.create({ name: slug, slug }, START);
  organizations.items.push(organization);
  roles.seedDefaults(organization.id, START);
  return organization;
}

/** Grava um papel customizado direto, sem as regras do caso de uso. */
function seedRole(
  name: string,
  permissions: string[],
  organization = acme,
): Role {
  // Catálogo efetivo do cenário: aceita as personalizadas já gravadas.
  const role = Role.create(
    { organizationId: organization.id, name, permissions },
    PermissionCatalog.withCustom(customPermissions.items.map((p) => p.key)),
    START,
  );
  roles.seed(role);
  return role;
}

function seedDeletedRole(name: string): Role {
  const role = seedRole(name, []);
  role.softDelete(START);
  roles.seed(role);
  return role;
}

function addMember(userId: string, role: Role): Membership {
  const membership = Membership.create(
    { organizationId: role.organizationId, userId, roleId: role.id },
    START,
  );
  memberships.items.push(membership);
  return membership;
}

function membershipOf(userId: string): Membership {
  return memberships.items.find(
    (m) => m.organizationId === acme.id && m.userId === userId,
  )!;
}

function stored(roleId: string): Role | undefined {
  return roles.items.find((role) => role.id === roleId);
}

/** O MEMBER passa a ter só estas permissões, num papel customizado. */
function giveMember(...permissions: string[]): Role {
  const role = seedRole('Gestor', permissions);
  membershipOf(MEMBER.id).changeRole(role.id, START);
  return role;
}

describe('Gestão de papéis', () => {
  beforeEach(() => {
    clock = new FixedClock(START);
    roles = new InMemoryRoleRepository(() => ({
      memberships: memberships.items,
      invitations: invitations.items,
    }));
    memberships = new InMemoryMembershipRepository(roles);
    invitations = new InMemoryInvitationRepository(memberships);
    organizations = new InMemoryOrganizationRepository();
    customPermissions = new InMemoryCustomPermissionRepository(roles);
    const users = new FakeUserDirectory();
    users.register(OWNER.sub, OWNER.id, { name: 'Olga' });
    users.register(MEMBER.sub, MEMBER.id, { name: 'Mário' });
    users.register(BRUNO.sub, BRUNO.id, { name: 'Bruno' });
    users.register(OUTSIDER.sub, OUTSIDER.id);

    const transactions = new FakeTransactionManager();
    const access = new OrganizationAccessService(
      organizations,
      memberships,
      roles,
    );
    createRole = new CreateRoleUseCase(
      organizations,
      roles,
      customPermissions,
      users,
      access,
      new InMemoryAuditLog(),
      transactions,
      clock,
    );
    updateRole = new UpdateRoleUseCase(
      organizations,
      roles,
      memberships,
      customPermissions,
      users,
      access,
      new InMemoryAuditLog(),
      transactions,
      clock,
    );
    deleteRole = new DeleteRoleUseCase(
      organizations,
      roles,
      users,
      access,
      new InMemoryAuditLog(),
      transactions,
      clock,
    );
    assignRole = new AssignRoleUseCase(
      organizations,
      memberships,
      roles,
      users,
      access,
      new InMemoryAuditLog(),
      transactions,
      clock,
    );
    listRoles = new ListOrganizationRolesUseCase(
      roles,
      memberships,
      users,
      access,
    );
    getMyPermissions = new GetMyPermissionsUseCase(
      customPermissions,
      users,
      access,
    );

    acme = createOrganization('acme');
    ownerRole = roles.systemRole(acme.id, RoleSystemKey.OWNER);
    memberRole = roles.systemRole(acme.id, RoleSystemKey.MEMBER);
    addMember(OWNER.id, ownerRole);
    addMember(MEMBER.id, memberRole);
    clock.set(LATER);
  });

  describe('CreateRoleUseCase', () => {
    function create(
      name: string,
      permissions: string[] = [],
      who: { sub: string } = OWNER,
    ) {
      return createRole.execute({
        cognitoSub: who.sub,
        organizationId: acme.id,
        name,
        permissions,
      });
    }

    it('cria o papel com nome normalizado e permissões sem repetição, na ordem do catálogo', async () => {
      const { role, memberCount } = await createRole.execute({
        cognitoSub: OWNER.sub,
        organizationId: acme.id.toUpperCase(),
        name: '  Time   Financeiro ',
        permissions: [ROLES_READ, MEMBERS_READ, ROLES_READ],
      });

      expect(role).toMatchObject({
        organizationId: acme.id,
        name: 'Time Financeiro',
        systemKey: null,
        permissions: [MEMBERS_READ, ROLES_READ],
        createdAt: LATER,
      });
      expect(memberCount).toBe(0);
      expect(stored(role.id)?.permissions).toEqual([MEMBERS_READ, ROLES_READ]);
    });

    it('aceita conjunto vazio de permissões', async () => {
      const { role } = await create('Leitor sem nada');

      expect(stored(role.id)?.permissions).toEqual([]);
    });

    it('não membro: NOT_FOUND; MEMBER sem roles:manage: FORBIDDEN; nada é gravado', async () => {
      await expect(create('Financeiro', [], OUTSIDER)).rejects.toBeInstanceOf(
        OrganizationNotFoundError,
      );
      await expect(create('Financeiro', [], MEMBER)).rejects.toBeInstanceOf(
        OrganizationPermissionDeniedError,
      );
      expect(roles.items).toHaveLength(2);
    });

    it('chave fora do catálogo: INVALID_PERMISSION; nome vazio: INVALID_ROLE', async () => {
      await expect(
        create('Financeiro', [MEMBERS_READ, 'billing:read']),
      ).rejects.toBeInstanceOf(InvalidPermissionError);
      await expect(create('   ')).rejects.toBeInstanceOf(InvalidRoleError);
      expect(roles.items).toHaveLength(2);
    });

    it.each(['owner', '  MEMBER ', 'financeiro', 'FINANCEIRO'])(
      'nome que colide sem diferenciar a caixa (%j): ROLE_NAME_TAKEN',
      async (name) => {
        seedRole('Financeiro', []);

        await expect(create(name)).rejects.toBeInstanceOf(RoleNameTakenError);
        expect(roles.items).toHaveLength(3);
      },
    );

    it('o nome de um papel apagado pode ser reaproveitado', async () => {
      seedDeletedRole('Financeiro');

      await expect(create('financeiro')).resolves.toBeDefined();
    });

    it('o mesmo nome em outra organização não colide', async () => {
      seedRole('Financeiro', [], createOrganization('beta'));

      await expect(create('Financeiro')).resolves.toBeDefined();
    });

    it('limite de 50 papéis customizados não apagados; os de sistema e os apagados não contam', async () => {
      for (let i = 1; i <= Role.MAX_CUSTOM_PER_ORGANIZATION - 1; i++) {
        seedRole(`Papel ${i}`, []);
      }
      seedDeletedRole('Apagado');

      await expect(create('Quinquagésimo')).resolves.toBeDefined();
      await expect(create('Quinquagésimo primeiro')).rejects.toBeInstanceOf(
        RoleLimitReachedError,
      );
      expect(Role.MAX_CUSTOM_PER_ORGANIZATION).toBe(50);
    });

    it('anti-escalada: só cria com permissões que tem', async () => {
      giveMember(ROLES_MANAGE, MEMBERS_READ);

      await expect(
        create('Removedor', [MEMBERS_READ, MEMBERS_REMOVE], MEMBER),
      ).rejects.toBeInstanceOf(PrivilegeEscalationError);
      await expect(
        create('Leitor', [MEMBERS_READ], MEMBER),
      ).resolves.toBeDefined();
      await expect(create('Vazio', [], MEMBER)).resolves.toBeDefined();
      expect(roles.items.map((r) => r.name)).not.toContain('Removedor');
    });
  });

  describe('UpdateRoleUseCase', () => {
    function update(
      roleId: string,
      changes: { name?: string; permissions?: string[] },
      who: { sub: string } = OWNER,
    ) {
      return updateRole.execute({
        cognitoSub: who.sub,
        organizationId: acme.id,
        roleId,
        ...changes,
      });
    }

    it('troca nome e permissões e devolve a contagem de membros', async () => {
      const finance = seedRole('Financeiro', [MEMBERS_READ]);
      addMember(BRUNO.id, finance);

      const { role, memberCount } = await updateRole.execute({
        cognitoSub: OWNER.sub,
        organizationId: acme.id.toUpperCase(),
        roleId: finance.id.toUpperCase(),
        name: ' Contas  a Pagar ',
        permissions: [MEMBERS_INVITE, MEMBERS_READ, MEMBERS_INVITE],
      });

      expect(role).toMatchObject({
        id: finance.id,
        name: 'Contas a Pagar',
        permissions: [MEMBERS_READ, MEMBERS_INVITE],
        updatedAt: LATER,
      });
      expect(memberCount).toBe(1);
      expect(stored(finance.id)).toMatchObject({
        name: 'Contas a Pagar',
        permissions: [MEMBERS_READ, MEMBERS_INVITE],
      });
    });

    it('renomear só trocando a caixa ("gerente" → "Gerente") é aceito: o próprio papel não colide', async () => {
      const manager = seedRole('gerente', []);

      const { role } = await update(manager.id, { name: 'Gerente' });

      expect(role.name).toBe('Gerente');
      expect(stored(manager.id)?.name).toBe('Gerente');
    });

    it('nome de outro papel, até de sistema: ROLE_NAME_TAKEN e nada muda', async () => {
      const finance = seedRole('Financeiro', [MEMBERS_READ]);
      seedRole('Vendas', []);

      for (const name of ['vendas', 'OWNER']) {
        await expect(
          update(finance.id, { name, permissions: [] }),
        ).rejects.toBeInstanceOf(RoleNameTakenError);
      }
      expect(stored(finance.id)).toMatchObject({
        name: 'Financeiro',
        permissions: [MEMBERS_READ],
        updatedAt: START,
      });
    });

    it('campo ausente não muda', async () => {
      const finance = seedRole('Financeiro', [MEMBERS_READ]);

      await update(finance.id, { permissions: [ROLES_READ] });
      expect(stored(finance.id)).toMatchObject({
        name: 'Financeiro',
        permissions: [ROLES_READ],
      });

      await update(finance.id, { name: 'Contas' });
      expect(stored(finance.id)).toMatchObject({
        name: 'Contas',
        permissions: [ROLES_READ],
      });
    });

    it('OWNER não muda nada: SYSTEM_ROLE_IMMUTABLE', async () => {
      for (const changes of [{ name: 'Dono' }, { permissions: [] }]) {
        await expect(update(ownerRole.id, changes)).rejects.toBeInstanceOf(
          SystemRoleImmutableError,
        );
      }
      expect(stored(ownerRole.id)).toMatchObject({
        name: 'Owner',
        permissions: [],
      });
    });

    it('MEMBER: o nome não muda, as permissões sim', async () => {
      await expect(
        update(memberRole.id, { name: 'Membro' }),
      ).rejects.toBeInstanceOf(SystemRoleImmutableError);

      const { role } = await update(memberRole.id, {
        name: 'Member',
        permissions: [MEMBERS_READ, MEMBERS_INVITE],
      });

      expect(role.permissions).toEqual([MEMBERS_READ, MEMBERS_INVITE]);
      expect(stored(memberRole.id)).toMatchObject({
        name: 'Member',
        permissions: [MEMBERS_READ, MEMBERS_INVITE],
      });
    });

    it.each([
      ['malformado', () => 'nao-e-uuid'],
      ['inexistente', () => MISSING_ID],
      ['apagado', () => seedDeletedRole('Antigo').id],
      [
        'de outra organização',
        () => seedRole('Financeiro', [], createOrganization('beta')).id,
      ],
    ])('papel %s: ROLE_NOT_FOUND', async (_, roleId) => {
      await expect(update(roleId(), { name: 'Outro' })).rejects.toBeInstanceOf(
        RoleNotFoundError,
      );
    });

    it('chave fora do catálogo: INVALID_PERMISSION e nada muda', async () => {
      const finance = seedRole('Financeiro', [MEMBERS_READ]);

      await expect(
        update(finance.id, { permissions: ['members:delete'] }),
      ).rejects.toBeInstanceOf(InvalidPermissionError);
      expect(stored(finance.id)?.permissions).toEqual([MEMBERS_READ]);
    });

    it('anti-escalada: não adiciona nem remove permissão que não tem', async () => {
      giveMember(ROLES_MANAGE, MEMBERS_READ, MEMBERS_INVITE);
      const target = seedRole('Alvo', [MEMBERS_READ, MEMBERS_REMOVE]);

      await expect(
        update(
          target.id,
          { permissions: [MEMBERS_READ, ORGANIZATIONS_UPDATE, MEMBERS_REMOVE] },
          MEMBER,
        ),
      ).rejects.toBeInstanceOf(PrivilegeEscalationError);
      await expect(
        update(target.id, { permissions: [MEMBERS_READ] }, MEMBER),
      ).rejects.toBeInstanceOf(PrivilegeEscalationError);
      expect(stored(target.id)?.permissions).toEqual([
        MEMBERS_READ,
        MEMBERS_REMOVE,
      ]);

      // Mexer só no que tem passa, mesmo mantendo o que não tem.
      const { role } = await update(
        target.id,
        { permissions: [MEMBERS_INVITE, MEMBERS_REMOVE] },
        MEMBER,
      );
      expect(role.permissions).toEqual([MEMBERS_INVITE, MEMBERS_REMOVE]);
    });

    it('não membro: NOT_FOUND; MEMBER sem roles:manage: FORBIDDEN', async () => {
      const finance = seedRole('Financeiro', []);

      await expect(
        update(finance.id, { name: 'X' }, OUTSIDER),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
      await expect(
        update(finance.id, { name: 'X' }, MEMBER),
      ).rejects.toBeInstanceOf(OrganizationPermissionDeniedError);
    });
  });

  describe('DeleteRoleUseCase', () => {
    function remove(roleId: string, who: { sub: string } = OWNER) {
      return deleteRole.execute({
        cognitoSub: who.sub,
        organizationId: acme.id,
        roleId,
      });
    }

    function invitationWith(role: Role, email = 'bruno@example.com') {
      return Invitation.create(
        {
          organizationId: acme.id,
          email,
          roleId: role.id,
          invitedByUserId: OWNER.id,
        },
        START,
      );
    }

    it('apaga papel sem uso: some das buscas e da listagem', async () => {
      const finance = seedRole('Financeiro', []);

      await deleteRole.execute({
        cognitoSub: OWNER.sub,
        organizationId: acme.id.toUpperCase(),
        roleId: finance.id.toUpperCase(),
      });

      expect(stored(finance.id)?.deletedAt).toEqual(LATER);
      expect(await roles.findById(acme.id, finance.id)).toBeNull();
      const listed = await listRoles.execute({
        cognitoSub: OWNER.sub,
        organizationId: acme.id,
      });
      expect(listed.map(({ role }) => role.id)).not.toContain(finance.id);
    });

    it('membership ACTIVE com o papel: ROLE_IN_USE', async () => {
      const finance = seedRole('Financeiro', []);
      addMember(BRUNO.id, finance);

      await expect(remove(finance.id)).rejects.toBeInstanceOf(RoleInUseError);
      expect(stored(finance.id)?.isDeleted()).toBe(false);
    });

    it('convite PENDING com o papel, mesmo expirado: ROLE_IN_USE', async () => {
      const finance = seedRole('Financeiro', []);
      invitations.seed(invitationWith(finance));
      clock.advance(30 * 24 * 60 * 60 * 1000);

      await expect(remove(finance.id)).rejects.toBeInstanceOf(RoleInUseError);
    });

    it('membership REMOVED e convites respondidos não contam como uso', async () => {
      const finance = seedRole('Financeiro', []);
      addMember(BRUNO.id, finance).remove(START);
      const revoked = invitationWith(finance);
      revoked.revoke(START);
      invitations.seed(revoked);

      await expect(remove(finance.id)).resolves.toBeUndefined();
      expect(stored(finance.id)?.isDeleted()).toBe(true);
    });

    it('papéis de sistema: SYSTEM_ROLE_IMMUTABLE (antes do ROLE_IN_USE)', async () => {
      for (const role of [ownerRole, memberRole]) {
        await expect(remove(role.id)).rejects.toBeInstanceOf(
          SystemRoleImmutableError,
        );
      }
    });

    it.each([
      ['malformado', () => 'nao-e-uuid'],
      ['já apagado', () => seedDeletedRole('Antigo').id],
      [
        'de outra organização',
        () => seedRole('Financeiro', [], createOrganization('beta')).id,
      ],
    ])('papel %s: ROLE_NOT_FOUND', async (_, roleId) => {
      await expect(remove(roleId())).rejects.toBeInstanceOf(RoleNotFoundError);
    });

    it('não membro: NOT_FOUND; MEMBER sem roles:manage: FORBIDDEN', async () => {
      const finance = seedRole('Financeiro', []);

      await expect(remove(finance.id, OUTSIDER)).rejects.toBeInstanceOf(
        OrganizationNotFoundError,
      );
      await expect(remove(finance.id, MEMBER)).rejects.toBeInstanceOf(
        OrganizationPermissionDeniedError,
      );
      expect(stored(finance.id)?.isDeleted()).toBe(false);
    });
  });

  describe('AssignRoleUseCase', () => {
    function assign(
      userId: string,
      roleId: string,
      who: { sub: string } = OWNER,
    ) {
      return assignRole.execute({
        cognitoSub: who.sub,
        organizationId: acme.id,
        userId,
        roleId,
      });
    }

    it('troca o papel do membro e devolve membro, perfil e papel novo', async () => {
      const finance = seedRole('Financeiro', [MEMBERS_READ]);

      const result = await assignRole.execute({
        cognitoSub: OWNER.sub,
        organizationId: acme.id.toUpperCase(),
        userId: MEMBER.id.toUpperCase(),
        roleId: finance.id.toUpperCase(),
      });

      expect(result.membership).toMatchObject({
        userId: MEMBER.id,
        roleId: finance.id,
        updatedAt: LATER,
      });
      expect(result.profile).toMatchObject({ id: MEMBER.id, name: 'Mário' });
      expect(result.role.id).toBe(finance.id);
      expect(membershipOf(MEMBER.id).roleId).toBe(finance.id);
    });

    it('mesmo papel que o atual: devolve o membro sem gravar', async () => {
      const result = await assign(MEMBER.id, memberRole.id);

      expect(result.role.id).toBe(memberRole.id);
      expect(membershipOf(MEMBER.id).updatedAt).toEqual(START);
    });

    it.each([
      ['id malformado', () => 'nao-e-uuid'],
      ['não membro', () => OUTSIDER.id],
      [
        'membro removido',
        () => {
          addMember(BRUNO.id, memberRole).remove(START);
          return BRUNO.id;
        },
      ],
    ])('alvo %s: MEMBER_NOT_FOUND', async (_, userId) => {
      await expect(assign(userId(), memberRole.id)).rejects.toBeInstanceOf(
        MemberNotFoundError,
      );
    });

    it.each([
      ['malformado', () => 'nao-e-uuid'],
      ['inexistente', () => MISSING_ID],
      ['apagado', () => seedDeletedRole('Antigo').id],
      [
        'de outra organização',
        () => seedRole('Financeiro', [], createOrganization('beta')).id,
      ],
    ])('papel %s: ROLE_NOT_FOUND e nada muda', async (_, roleId) => {
      await expect(assign(MEMBER.id, roleId())).rejects.toBeInstanceOf(
        RoleNotFoundError,
      );
      expect(membershipOf(MEMBER.id).roleId).toBe(memberRole.id);
    });

    it('rebaixar o último OWNER, inclusive a si mesmo: LAST_OWNER e nada muda', async () => {
      await expect(assign(OWNER.id, memberRole.id)).rejects.toBeInstanceOf(
        LastOwnerError,
      );
      expect(membershipOf(OWNER.id).roleId).toBe(ownerRole.id);
    });

    it('com outro OWNER, o OWNER pode se rebaixar', async () => {
      addMember(BRUNO.id, ownerRole);

      await assign(OWNER.id, memberRole.id);

      expect(membershipOf(OWNER.id).roleId).toBe(memberRole.id);
      expect(membershipOf(BRUNO.id).roleId).toBe(ownerRole.id);
    });

    it('OWNER promove a OWNER', async () => {
      await assign(MEMBER.id, ownerRole.id);

      expect(membershipOf(MEMBER.id).roleId).toBe(ownerRole.id);
    });

    describe('anti-escalada (quem atribui tem roles:assign e members:read)', () => {
      let manager: Role;

      beforeEach(() => {
        manager = giveMember(ROLES_ASSIGN, MEMBERS_READ);
        addMember(BRUNO.id, memberRole);
      });

      it('troca entre papéis que cobre', async () => {
        const reader = seedRole('Leitor', [MEMBERS_READ]);

        await assign(BRUNO.id, reader.id, MEMBER);

        expect(membershipOf(BRUNO.id).roleId).toBe(reader.id);
      });

      it('não atribui OWNER nem papel com permissão que não tem', async () => {
        const remover = seedRole('Removedor', [MEMBERS_REMOVE]);

        for (const role of [ownerRole, remover]) {
          await expect(
            assign(BRUNO.id, role.id, MEMBER),
          ).rejects.toBeInstanceOf(PrivilegeEscalationError);
        }
        expect(membershipOf(BRUNO.id).roleId).toBe(memberRole.id);
      });

      it('não mexe em quem é OWNER, nem para confirmar o mesmo papel', async () => {
        for (const roleId of [memberRole.id, ownerRole.id]) {
          await expect(assign(OWNER.id, roleId, MEMBER)).rejects.toBeInstanceOf(
            PrivilegeEscalationError,
          );
        }
      });

      it('não tira de alguém um papel que não cobre', async () => {
        const remover = seedRole('Removedor', [MEMBERS_REMOVE]);
        membershipOf(BRUNO.id).changeRole(remover.id, START);

        await expect(
          assign(BRUNO.id, memberRole.id, MEMBER),
        ).rejects.toBeInstanceOf(PrivilegeEscalationError);
      });

      it('autopromoção é barrada; auto-rebaixamento passa', async () => {
        const bigger = seedRole('Maior', [
          ROLES_ASSIGN,
          MEMBERS_READ,
          ROLES_READ,
        ]);

        await expect(
          assign(MEMBER.id, bigger.id, MEMBER),
        ).rejects.toBeInstanceOf(PrivilegeEscalationError);

        await assign(MEMBER.id, memberRole.id, MEMBER);
        expect(membershipOf(MEMBER.id).roleId).toBe(memberRole.id);
        expect(manager.id).not.toBe(memberRole.id);
      });
    });

    it('não membro: NOT_FOUND; MEMBER sem roles:assign: FORBIDDEN', async () => {
      await expect(
        assign(MEMBER.id, memberRole.id, OUTSIDER),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
      await expect(
        assign(OWNER.id, memberRole.id, MEMBER),
      ).rejects.toBeInstanceOf(OrganizationPermissionDeniedError);
    });
  });

  describe('ListOrganizationRolesUseCase', () => {
    it('sistema primeiro, depois por nome sem diferenciar a caixa; sem apagados; com a contagem de ativos', async () => {
      const gama = seedRole('gama', []);
      const beta = seedRole('Beta', [MEMBERS_READ]);
      const alfa = seedRole('alfa', []);
      seedDeletedRole('Apagado');
      seedRole('Outra org', [], createOrganization('beta'));
      addMember(BRUNO.id, beta);
      addMember(OUTSIDER.id, beta).remove(START);

      const result = await listRoles.execute({
        cognitoSub: OWNER.sub,
        organizationId: acme.id.toUpperCase(),
      });

      expect(
        result.map(({ role, memberCount }) => [role.id, memberCount]),
      ).toEqual([
        [ownerRole.id, 1],
        [memberRole.id, 1],
        [alfa.id, 0],
        [beta.id, 1],
        [gama.id, 0],
      ]);
    });

    it('exige roles:read: MEMBER recebe FORBIDDEN até ganhar a permissão; não membro, NOT_FOUND', async () => {
      const input = { cognitoSub: MEMBER.sub, organizationId: acme.id };

      await expect(listRoles.execute(input)).rejects.toBeInstanceOf(
        OrganizationPermissionDeniedError,
      );
      roles.grant(memberRole.id, ROLES_READ);
      await expect(listRoles.execute(input)).resolves.toHaveLength(2);
      await expect(
        listRoles.execute({ ...input, cognitoSub: OUTSIDER.sub }),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });
  });

  describe('GetMyPermissionsUseCase', () => {
    function permissionsOf(who: { sub: string }) {
      return getMyPermissions.execute({
        cognitoSub: who.sub,
        organizationId: acme.id.toUpperCase(),
      });
    }

    it('OWNER recebe o catálogo inteiro', async () => {
      expect(await permissionsOf(OWNER)).toEqual(
        Object.values(OrganizationPermission),
      );
    });

    it('os demais recebem as do papel, na ordem do catálogo, sem precisar de permissão', async () => {
      expect(await permissionsOf(MEMBER)).toEqual([MEMBERS_READ]);

      giveMember(ROLES_ASSIGN, MEMBERS_INVITE);
      expect(await permissionsOf(MEMBER)).toEqual([
        MEMBERS_INVITE,
        ROLES_ASSIGN,
      ]);
    });

    it('não membro: NOT_FOUND', async () => {
      await expect(permissionsOf(OUTSIDER)).rejects.toBeInstanceOf(
        OrganizationNotFoundError,
      );
    });
  });

  describe('permissões personalizadas no catálogo efetivo', () => {
    const APPROVE = 'invoices:approve';
    const SIGN = 'contracts:sign';

    function seedCustom(key: string, organization = acme) {
      customPermissions.seed(
        CustomPermission.create(
          { organizationId: organization.id, key, description: key },
          START,
        ),
      );
    }

    beforeEach(() => {
      seedCustom(APPROVE);
      seedCustom(SIGN);
    });

    it('createRole aceita personalizada da organização; de outra ou inexistente: INVALID_PERMISSION', async () => {
      seedCustom('payments:refund', createOrganization('beta'));
      const create = (name: string, permissions: string[]) =>
        createRole.execute({
          cognitoSub: OWNER.sub,
          organizationId: acme.id,
          name,
          permissions,
        });

      const { role } = await create('Financeiro', [APPROVE, MEMBERS_READ]);
      expect(stored(role.id)?.permissions).toEqual([MEMBERS_READ, APPROVE]);

      for (const key of ['payments:refund', 'invoices:refund']) {
        await expect(create(`Com ${key}`, [key])).rejects.toBeInstanceOf(
          InvalidPermissionError,
        );
      }
    });

    it('updateRole concede e tira personalizada; a que saiu do catálogo não é aceita', async () => {
      const finance = seedRole('Financeiro', [MEMBERS_READ]);
      const update = (permissions: string[]) =>
        updateRole.execute({
          cognitoSub: OWNER.sub,
          organizationId: acme.id,
          roleId: finance.id,
          permissions,
        });

      await update([APPROVE, SIGN]);
      expect(stored(finance.id)?.permissions).toEqual([SIGN, APPROVE]);

      await update([SIGN]);
      expect(stored(finance.id)?.permissions).toEqual([SIGN]);

      const approve = await customPermissions.findByKey(acme.id, APPROVE);
      await customPermissions.delete(approve!);
      await expect(update([APPROVE])).rejects.toBeInstanceOf(
        InvalidPermissionError,
      );
    });

    it('anti-escalada: quem não tem a personalizada não a concede', async () => {
      giveMember(ROLES_MANAGE, APPROVE);

      await expect(
        createRole.execute({
          cognitoSub: MEMBER.sub,
          organizationId: acme.id,
          name: 'Assinatura',
          permissions: [SIGN],
        }),
      ).rejects.toBeInstanceOf(PrivilegeEscalationError);
      await expect(
        createRole.execute({
          cognitoSub: MEMBER.sub,
          organizationId: acme.id,
          name: 'Aprovação',
          permissions: [APPROVE],
        }),
      ).resolves.toBeDefined();
    });

    it('myPermissions: OWNER recebe sistema e personalizadas da organização; os demais, as do papel', async () => {
      seedCustom('payments:refund', createOrganization('beta'));
      const permissionsOf = (who: { sub: string }) =>
        getMyPermissions.execute({
          cognitoSub: who.sub,
          organizationId: acme.id,
        });

      expect(await permissionsOf(OWNER)).toEqual([
        ...Object.values(OrganizationPermission),
        SIGN,
        APPROVE,
      ]);

      giveMember(MEMBERS_READ, APPROVE);
      expect(await permissionsOf(MEMBER)).toEqual([MEMBERS_READ, APPROVE]);
    });
  });
});
