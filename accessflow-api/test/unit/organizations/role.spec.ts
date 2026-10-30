import { describe, expect, it } from 'vitest';
import {
  Role,
  RoleSystemKey,
} from '@/modules/organizations/domain/entities/role.entity';
import { InvalidRoleError } from '@/modules/organizations/domain/errors/invalid-role.error';
import { InvalidPermissionError } from '@/modules/organizations/domain/errors/invalid-permission.error';
import { SystemRoleImmutableError } from '@/modules/organizations/domain/errors/system-role-immutable.error';
import { RoleName } from '@/modules/organizations/domain/value-objects/role-name.vo';
import {
  PermissionCatalog,
  OrganizationPermission,
} from '@/modules/organizations/policies/organization-permission';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const LATER = new Date('2026-03-02T12:00:00.000Z');
const { MEMBERS_READ, MEMBERS_INVITE, MEMBERS_REMOVE, ROLES_READ } =
  OrganizationPermission;

describe('RoleName', () => {
  it('tira os espaços das pontas e colapsa os internos, de qualquer tipo', () => {
    expect(RoleName.create('  Time   de\tSuporte\u00a0 N1 ').value).toBe(
      'Time de Suporte N1',
    );
  });

  it.each(['', '   ', '\t\n'])('recusa nome vazio: %j', (raw) => {
    expect(() => RoleName.create(raw)).toThrow(InvalidRoleError);
  });

  it('aceita até 50 caracteres, contando depois de normalizar', () => {
    expect(RoleName.create('a'.repeat(50)).value).toHaveLength(50);
    expect(
      RoleName.create(`  ${'a'.repeat(25)}    ${'b'.repeat(24)}  `).value,
    ).toHaveLength(50);
    expect(() => RoleName.create('a'.repeat(51))).toThrow(InvalidRoleError);
  });

  it('conta caracteres, não unidades UTF-16', () => {
    expect(RoleName.create('🚀'.repeat(50)).value).toBe('🚀'.repeat(50));
    expect(() => RoleName.create('🚀'.repeat(51))).toThrow(InvalidRoleError);
  });

  it('compara sem diferenciar maiúsculas e minúsculas, depois de normalizar', () => {
    const owner = RoleName.create('Owner');

    expect(owner.sameAs(RoleName.create('  owner '))).toBe(true);
    expect(owner.sameAs(RoleName.create('OWNER'))).toBe(true);
    expect(owner.sameAs(RoleName.create('Owners'))).toBe(false);
    expect(
      RoleName.create('Time  de suporte').sameAs(
        RoleName.create('time de SUPORTE'),
      ),
    ).toBe(true);
    // A grafia original é preservada; só a comparação ignora a caixa.
    expect(RoleName.create('  owner ').value).toBe('owner');
  });

  it('formas Unicode diferentes do mesmo texto viram o mesmo nome (NFC)', () => {
    const composed = 'Gerência'; // "ê" num só código
    const decomposed = 'Gerência'; // "e" + acento circunflexo combinante
    expect(composed).not.toBe(decomposed);

    const name = RoleName.create(decomposed);

    expect(name.value).toBe(composed);
    expect(name.key).toBe(RoleName.create(composed).key);
    expect(name.sameAs(RoleName.create('GERÊNCIA'))).toBe(true);
    // O acento combinante não conta como caractere a mais.
    expect(RoleName.create('ê'.repeat(50)).value).toBe('ê'.repeat(50));
  });
});

describe('Role', () => {
  const { owner, member } = Role.createDefaults('org-1', NOW);
  // Instâncias novas para os testes que alteram o papel.
  const defaults = () => Role.createDefaults('org-1', NOW);

  describe('createDefaults', () => {
    it('cria o OWNER e o MEMBER de sistema da organização', () => {
      expect([owner, member].map((role) => role.organizationId)).toEqual([
        'org-1',
        'org-1',
      ]);
      expect(owner).toMatchObject({
        name: 'Owner',
        systemKey: RoleSystemKey.OWNER,
        permissions: [],
        description: null,
        deletedAt: null,
        createdAt: NOW,
      });
      expect(member).toMatchObject({
        name: 'Member',
        systemKey: RoleSystemKey.MEMBER,
        permissions: [OrganizationPermission.MEMBERS_READ],
      });
      expect(owner.id).not.toBe(member.id);
    });

    it('os dois são de sistema, só o OWNER é OWNER e nenhum está apagado', () => {
      expect([owner.isSystem(), member.isSystem()]).toEqual([true, true]);
      expect([owner.isOwner(), member.isOwner()]).toEqual([true, false]);
      expect([owner.isDeleted(), member.isDeleted()]).toEqual([false, false]);
    });
  });

  describe('grants', () => {
    it('OWNER tem até permissão que não existe no catálogo', () => {
      expect(owner.grants('permissao:inexistente')).toBe(true);
      for (const permission of Object.values(OrganizationPermission)) {
        expect(owner.grants(permission)).toBe(true);
      }
    });

    it('MEMBER tem só members:read', () => {
      const granted = Object.values(OrganizationPermission).filter(
        (permission) => member.grants(permission),
      );

      expect(granted).toEqual([OrganizationPermission.MEMBERS_READ]);
      expect(member.grants('permissao:inexistente')).toBe(false);
    });

    it('papel customizado tem só as permissões gravadas', () => {
      const custom = Role.restore({
        id: 'role-financeiro',
        organizationId: 'org-1',
        name: 'Financeiro',
        description: null,
        systemKey: null,
        permissions: [OrganizationPermission.MEMBERS_INVITE],
        deletedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      });

      expect(custom.isSystem()).toBe(false);
      expect(custom.grants(OrganizationPermission.MEMBERS_INVITE)).toBe(true);
      expect(custom.grants(OrganizationPermission.MEMBERS_READ)).toBe(false);
    });
  });

  describe('effectivePermissions', () => {
    it('OWNER: o catálogo inteiro; os demais: as gravadas', () => {
      expect(owner.effectivePermissions(PermissionCatalog.system())).toEqual(
        Object.values(OrganizationPermission),
      );
      expect(member.effectivePermissions(PermissionCatalog.system())).toEqual([
        MEMBERS_READ,
      ]);
      expect(
        Role.create(
          { organizationId: 'org-1', name: 'Vazio', permissions: [] },
          PermissionCatalog.system(),
          NOW,
        ).effectivePermissions(PermissionCatalog.system()),
      ).toEqual([]);
    });
  });

  describe('create (papel customizado)', () => {
    it('cria sem systemKey, com nome normalizado e permissões sem repetição, na ordem do catálogo', () => {
      const role = Role.create(
        {
          organizationId: 'org-1',
          name: '  Time   de Suporte ',
          permissions: [ROLES_READ, MEMBERS_INVITE, ROLES_READ, MEMBERS_READ],
        },
        PermissionCatalog.system(),
        NOW,
      );

      expect(role).toMatchObject({
        organizationId: 'org-1',
        name: 'Time de Suporte',
        description: null,
        systemKey: null,
        permissions: [MEMBERS_READ, MEMBERS_INVITE, ROLES_READ],
        deletedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      });
      expect(role.isSystem()).toBe(false);
      expect(role.isOwner()).toBe(false);
      expect(role.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('aceita conjunto vazio', () => {
      const role = Role.create(
        { organizationId: 'org-1', name: 'Leitor', permissions: [] },
        PermissionCatalog.system(),
        NOW,
      );

      expect(role.permissions).toEqual([]);
      expect(role.grants(MEMBERS_READ)).toBe(false);
    });

    it.each([
      ['fora do catálogo', ['members:read', 'billing:read']],
      ['com caixa diferente', ['Members:Read']],
      ['vazia', ['']],
    ])('recusa chave %s', (_, permissions) => {
      expect(() =>
        Role.create(
          { organizationId: 'org-1', name: 'Financeiro', permissions },
          PermissionCatalog.system(),
          NOW,
        ),
      ).toThrow(InvalidPermissionError);
    });

    it('recusa nome inválido', () => {
      expect(() =>
        Role.create(
          { organizationId: 'org-1', name: '  ', permissions: [] },
          PermissionCatalog.system(),
          NOW,
        ),
      ).toThrow(InvalidRoleError);
    });
  });

  describe('rename', () => {
    const custom = () =>
      Role.create(
        { organizationId: 'org-1', name: 'Financeiro', permissions: [] },
        PermissionCatalog.system(),
        NOW,
      );

    it('renomeia papel customizado, normalizando o nome', () => {
      const role = custom();

      role.rename('  Contas   a Pagar ', LATER);

      expect(role.name).toBe('Contas a Pagar');
      expect(role.updatedAt).toEqual(LATER);
    });

    it('trocar só a caixa é alteração', () => {
      const role = custom();

      role.rename('financeiro', LATER);

      expect(role.name).toBe('financeiro');
      expect(role.updatedAt).toEqual(LATER);
    });

    it('o mesmo nome, depois de normalizar, não muda nada', () => {
      const role = custom();

      role.rename(' Financeiro ', LATER);

      expect(role.name).toBe('Financeiro');
      expect(role.updatedAt).toEqual(NOW);
    });

    it('recusa nome inválido sem mudar nada', () => {
      const role = custom();

      expect(() => role.rename('a'.repeat(51), LATER)).toThrow(
        InvalidRoleError,
      );
      expect(role.name).toBe('Financeiro');
    });

    it.each([
      ['OWNER', 'Dono'],
      ['OWNER', 'owner'],
      ['MEMBER', 'Membro'],
      ['MEMBER', 'member'],
    ] as const)('%s não pode ser renomeado (para %j)', (key, name) => {
      const role = key === 'OWNER' ? defaults().owner : defaults().member;

      expect(() => role.rename(name, LATER)).toThrow(SystemRoleImmutableError);
      expect(role.updatedAt).toEqual(NOW);
    });

    it('papel de sistema com o mesmo nome: não muda nada e não é erro', () => {
      const { owner, member } = defaults();

      owner.rename('Owner', LATER);
      member.rename('  Member ', LATER);

      expect([owner.name, member.name]).toEqual(['Owner', 'Member']);
      expect([owner.updatedAt, member.updatedAt]).toEqual([NOW, NOW]);
    });
  });

  describe('setPermissions', () => {
    const custom = (permissions: string[]) =>
      Role.create(
        { organizationId: 'org-1', name: 'Financeiro', permissions },
        PermissionCatalog.system(),
        NOW,
      );

    it('troca as permissões e o que o papel concede', () => {
      const role = custom([MEMBERS_READ]);

      role.setPermissions(
        [MEMBERS_INVITE, MEMBERS_INVITE, ROLES_READ],
        PermissionCatalog.system(),
        LATER,
      );

      expect(role.permissions).toEqual([MEMBERS_INVITE, ROLES_READ]);
      expect(role.grants(MEMBERS_INVITE)).toBe(true);
      expect(role.grants(MEMBERS_READ)).toBe(false);
      expect(role.updatedAt).toEqual(LATER);
    });

    it('conjunto vazio tira tudo', () => {
      const role = custom([MEMBERS_READ, MEMBERS_REMOVE]);

      role.setPermissions([], PermissionCatalog.system(), LATER);

      expect(role.permissions).toEqual([]);
      expect(role.grants(MEMBERS_READ)).toBe(false);
    });

    it('o mesmo conjunto, em outra ordem ou com repetição, não muda nada', () => {
      const role = custom([MEMBERS_READ, ROLES_READ]);

      role.setPermissions(
        [ROLES_READ, MEMBERS_READ, ROLES_READ],
        PermissionCatalog.system(),
        LATER,
      );

      expect(role.updatedAt).toEqual(NOW);
    });

    it('recusa chave fora do catálogo sem mudar nada', () => {
      const role = custom([MEMBERS_READ]);

      expect(() =>
        role.setPermissions(
          [MEMBERS_INVITE, 'members:delete'],
          PermissionCatalog.system(),
          LATER,
        ),
      ).toThrow(InvalidPermissionError);
      expect(role.permissions).toEqual([MEMBERS_READ]);
      expect(role.grants(MEMBERS_INVITE)).toBe(false);
    });

    it('as do MEMBER podem ser trocadas', () => {
      const { member } = defaults();

      member.setPermissions(
        [MEMBERS_READ, MEMBERS_INVITE],
        PermissionCatalog.system(),
        LATER,
      );

      expect(member.permissions).toEqual([MEMBERS_READ, MEMBERS_INVITE]);
      expect(member.systemKey).toBe(RoleSystemKey.MEMBER);
    });

    it.each([[[]], [[MEMBERS_READ]]])(
      'as do OWNER, nunca (mesmo %j)',
      (permissions) => {
        const { owner } = defaults();

        expect(() =>
          owner.setPermissions(permissions, PermissionCatalog.system(), LATER),
        ).toThrow(SystemRoleImmutableError);
        expect(owner.updatedAt).toEqual(NOW);
      },
    );
  });

  describe('softDelete', () => {
    it('apaga papel customizado; repetir não muda a data', () => {
      const role = Role.create(
        { organizationId: 'org-1', name: 'Financeiro', permissions: [] },
        PermissionCatalog.system(),
        NOW,
      );

      role.softDelete(LATER);
      role.softDelete(new Date('2026-03-03T12:00:00.000Z'));

      expect(role.isDeleted()).toBe(true);
      expect(role.deletedAt).toEqual(LATER);
      expect(role.updatedAt).toEqual(LATER);
    });

    it('papéis de sistema não podem ser apagados', () => {
      const { owner, member } = defaults();

      for (const role of [owner, member]) {
        expect(() => role.softDelete(LATER)).toThrow(SystemRoleImmutableError);
        expect(role.isDeleted()).toBe(false);
      }
    });
  });

  it.each(['id', 'organizationId', 'name'] as const)(
    'restore exige %s',
    (field) => {
      expect(
        () =>
          Role.restore({
            id: member.id,
            organizationId: member.organizationId,
            name: member.name,
            description: member.description,
            systemKey: member.systemKey,
            permissions: member.permissions,
            deletedAt: member.deletedAt,
            createdAt: member.createdAt,
            updatedAt: member.updatedAt,
            [field]: ' ',
          }),
        // Dado corrompido no banco: Error comum (500), não DomainError (400).
      ).toThrow(/^Role inválido vindo do banco: INVALID_ROLE: /);
    },
  );
});
