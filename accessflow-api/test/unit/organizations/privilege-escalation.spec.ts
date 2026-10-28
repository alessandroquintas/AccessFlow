import { describe, expect, it } from 'vitest';
import { Role } from '@/modules/organizations/domain/entities/role.entity';
import { PrivilegeEscalationError } from '@/modules/organizations/domain/errors/privilege-escalation.error';
import {
  OrganizationPermission,
  PermissionCatalog,
} from '@/modules/organizations/policies/organization-permission';
import {
  ensureCanAssignRole,
  ensureCanChangePermissions,
  ensureCanCreateRole,
  ensureCanInviteWithRole,
} from '@/modules/organizations/policies/privilege-escalation';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const ALL = Object.values(OrganizationPermission);
const {
  ORGANIZATIONS_UPDATE,
  MEMBERS_READ,
  MEMBERS_INVITE,
  MEMBERS_REMOVE,
  ROLES_MANAGE,
  ROLES_ASSIGN,
} = OrganizationPermission;

const { owner, member } = Role.createDefaults('org-1', NOW);
const custom = (name: string, permissions: readonly string[]) =>
  Role.create(
    { organizationId: 'org-1', name, permissions },
    PermissionCatalog.system(),
    NOW,
  );

/** Gerencia e atribui papéis, mas não remove membros nem edita a organização. */
const manager = custom('Gestor', [
  MEMBERS_READ,
  MEMBERS_INVITE,
  ROLES_MANAGE,
  ROLES_ASSIGN,
]);
/** Papel customizado com o catálogo inteiro: ainda assim não é OWNER. */
const everything = custom('Tudo', ALL);
const remover = custom('Removedor', [MEMBERS_READ, MEMBERS_REMOVE]);
const recruiter = custom('Recrutador', [MEMBERS_INVITE]);
const empty = custom('Vazio', []);

const denied = (action: () => void) =>
  expect(action).toThrow(PrivilegeEscalationError);
const allowed = (action: () => void) => expect(action).not.toThrow();

describe('Anti-escalada de privilégio', () => {
  describe('createRole: permissões do papel ⊆ P(viewer)', () => {
    it('OWNER cria com qualquer conjunto do catálogo, e até com chave que não existe', () => {
      allowed(() => ensureCanCreateRole(owner, ALL));
      allowed(() => ensureCanCreateRole(owner, ['futura:acao']));
    });

    it('subconjunto do próprio papel, inclusive o conjunto inteiro', () => {
      allowed(() => ensureCanCreateRole(manager, [MEMBERS_READ]));
      allowed(() => ensureCanCreateRole(manager, manager.permissions));
      allowed(() => ensureCanCreateRole(everything, ALL));
    });

    it('conjunto vazio sempre passa, até para quem não tem nada', () => {
      allowed(() => ensureCanCreateRole(empty, []));
      allowed(() => ensureCanCreateRole(member, []));
    });

    it('chave repetida não muda o resultado', () => {
      allowed(() => ensureCanCreateRole(manager, [MEMBERS_READ, MEMBERS_READ]));
      denied(() =>
        ensureCanCreateRole(manager, [MEMBERS_REMOVE, MEMBERS_REMOVE]),
      );
    });

    it('uma permissão que o viewer não tem basta para recusar', () => {
      denied(() =>
        ensureCanCreateRole(manager, [MEMBERS_READ, MEMBERS_REMOVE]),
      );
      denied(() => ensureCanCreateRole(member, [MEMBERS_INVITE]));
      denied(() => ensureCanCreateRole(manager, ['futura:acao']));
    });
  });

  describe('updateRole: (adicionadas ∪ removidas) ⊆ P(viewer)', () => {
    it('adiciona e remove o que tem', () => {
      allowed(() =>
        ensureCanChangePermissions(manager, {
          before: [MEMBERS_READ],
          after: [MEMBERS_INVITE],
        }),
      );
    });

    it('não adiciona o que não tem', () => {
      denied(() =>
        ensureCanChangePermissions(manager, {
          before: [MEMBERS_READ],
          after: [MEMBERS_READ, MEMBERS_REMOVE],
        }),
      );
    });

    it('não remove o que não tem, nem para tirar', () => {
      denied(() =>
        ensureCanChangePermissions(manager, {
          before: [MEMBERS_READ, MEMBERS_REMOVE],
          after: [MEMBERS_READ],
        }),
      );
    });

    it('o que fica igual não conta, mesmo que o viewer não tenha', () => {
      allowed(() =>
        ensureCanChangePermissions(manager, {
          before: [MEMBERS_REMOVE, ORGANIZATIONS_UPDATE, MEMBERS_READ],
          after: [MEMBERS_REMOVE, ORGANIZATIONS_UPDATE, MEMBERS_INVITE],
        }),
      );
    });

    it('sem mudança (outra ordem, repetição) passa para qualquer viewer', () => {
      allowed(() =>
        ensureCanChangePermissions(empty, {
          before: [MEMBERS_REMOVE, MEMBERS_READ],
          after: [MEMBERS_READ, MEMBERS_REMOVE, MEMBERS_READ],
        }),
      );
      allowed(() =>
        ensureCanChangePermissions(empty, { before: [], after: [] }),
      );
    });

    it('OWNER muda qualquer coisa', () => {
      allowed(() =>
        ensureCanChangePermissions(owner, { before: ALL, after: [] }),
      );
    });
  });

  describe('assignRole: P(viewer) cobre o papel atual e o novo', () => {
    it('OWNER atribui OWNER e rebaixa OWNER', () => {
      allowed(() => ensureCanAssignRole(owner, { from: member, to: owner }));
      allowed(() => ensureCanAssignRole(owner, { from: owner, to: member }));
      allowed(() => ensureCanAssignRole(owner, { from: remover, to: manager }));
    });

    it('troca entre papéis que o viewer cobre', () => {
      allowed(() =>
        ensureCanAssignRole(manager, { from: member, to: manager }),
      );
      allowed(() => ensureCanAssignRole(manager, { from: empty, to: member }));
    });

    it('só OWNER atribui OWNER, mesmo para quem tem o catálogo inteiro', () => {
      denied(() => ensureCanAssignRole(manager, { from: member, to: owner }));
      denied(() =>
        ensureCanAssignRole(everything, { from: member, to: owner }),
      );
    });

    it('só OWNER mexe em quem é OWNER', () => {
      denied(() => ensureCanAssignRole(manager, { from: owner, to: member }));
      denied(() =>
        ensureCanAssignRole(everything, { from: owner, to: everything }),
      );
    });

    it('o papel atual do alvo também precisa ser coberto', () => {
      denied(() => ensureCanAssignRole(manager, { from: remover, to: member }));
    });

    it('autopromoção é barrada; auto-rebaixamento passa', () => {
      denied(() =>
        ensureCanAssignRole(manager, { from: manager, to: everything }),
      );
      allowed(() =>
        ensureCanAssignRole(manager, { from: manager, to: member }),
      );
    });
  });

  describe('inviteMember: P(viewer) cobre o papel do convite', () => {
    it('OWNER convida com qualquer papel', () => {
      for (const role of [owner, member, everything, remover]) {
        allowed(() => ensureCanInviteWithRole(owner, role));
      }
    });

    it('só OWNER convida como OWNER', () => {
      denied(() => ensureCanInviteWithRole(manager, owner));
      denied(() => ensureCanInviteWithRole(everything, owner));
    });

    it('papel coberto passa; com permissão que o viewer não tem, não', () => {
      allowed(() => ensureCanInviteWithRole(manager, member));
      allowed(() => ensureCanInviteWithRole(manager, empty));
      denied(() => ensureCanInviteWithRole(manager, remover));
    });

    it('mais estreito que a regra do 8a: members:invite sem members:read não convida como MEMBER', () => {
      denied(() => ensureCanInviteWithRole(recruiter, member));
      allowed(() => ensureCanInviteWithRole(recruiter, empty));
    });
  });

  it('a negação leva a organização do papel de quem age', () => {
    const attempts = [
      () => ensureCanCreateRole(manager, [MEMBERS_REMOVE]),
      () => ensureCanInviteWithRole(manager, owner),
      () => ensureCanAssignRole(manager, { from: member, to: everything }),
      () =>
        ensureCanChangePermissions(manager, {
          before: [ORGANIZATIONS_UPDATE],
          after: [],
        }),
    ];

    for (const attempt of attempts) {
      let error: unknown;
      try {
        attempt();
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(PrivilegeEscalationError);
      expect((error as PrivilegeEscalationError).securityDenial).toEqual({
        event: 'access.privilege_escalation',
        organizationId: 'org-1',
      });
    }
  });
});
