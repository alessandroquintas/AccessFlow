import { describe, expect, it } from 'vitest';
import { CustomPermission } from '@/modules/organizations/domain/entities/custom-permission.entity';
import { Role } from '@/modules/organizations/domain/entities/role.entity';
import { PermissionKey } from '@/modules/organizations/domain/value-objects/permission-key.vo';
import { PermissionDescription } from '@/modules/organizations/domain/value-objects/permission-description.vo';
import { InvalidPermissionKeyError } from '@/modules/organizations/domain/errors/invalid-permission-key.error';
import { InvalidPermissionDescriptionError } from '@/modules/organizations/domain/errors/invalid-permission-description.error';
import { ReservedPermissionResourceError } from '@/modules/organizations/domain/errors/reserved-permission-resource.error';
import { InvalidPermissionError } from '@/modules/organizations/domain/errors/invalid-permission.error';
import { PrivilegeEscalationError } from '@/modules/organizations/domain/errors/privilege-escalation.error';
import {
  OrganizationPermission,
  PERMISSION_CATALOG,
  PermissionCatalog,
  RESERVED_PERMISSION_RESOURCES,
  parsePermissions,
  resourceOf,
} from '@/modules/organizations/policies/organization-permission';
import {
  ensureCanChangePermissions,
  ensureCanCreateRole,
} from '@/modules/organizations/policies/privilege-escalation';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const LATER = new Date('2026-03-02T12:00:00.000Z');
const SYSTEM = Object.values(OrganizationPermission);
const { MEMBERS_READ, ROLES_MANAGE } = OrganizationPermission;

describe('PermissionKey', () => {
  it.each([
    'invoices:approve',
    'a:b',
    'contas-a-pagar:aprovar-2',
    `${'a'.repeat(40)}:${'b'.repeat(40)}`,
    'members:read',
  ])('aceita %j', (raw) => {
    expect(PermissionKey.create(raw).value).toBe(raw);
    expect(PermissionKey.isValid(raw)).toBe(true);
  });

  it.each([
    ['vazia', ''],
    ['sem ação', 'invoices'],
    ['sem recurso', ':approve'],
    ['dois separadores', 'a:b:c'],
    ['maiúscula', 'Invoices:approve'],
    ['começa por dígito', '1invoices:approve'],
    ['ação começa por hífen', 'invoices:-approve'],
    ['espaço', 'invoices: approve'],
    ['acento', 'faturas:aprovação'],
    ['sublinhado', 'invoices:approve_all'],
    ['recurso com 41', `${'a'.repeat(41)}:b`],
    ['ação com 41', `a:${'b'.repeat(41)}`],
  ])('recusa %s', (_, raw) => {
    expect(() => PermissionKey.create(raw)).toThrow(InvalidPermissionKeyError);
    expect(PermissionKey.isValid(raw)).toBe(false);
  });

  it('separa recurso e ação', () => {
    const key = PermissionKey.create('contas-a-pagar:aprovar');

    expect([key.resource, key.action]).toEqual(['contas-a-pagar', 'aprovar']);
  });

  it('todas as chaves de sistema têm o formato', () => {
    for (const key of SYSTEM) {
      expect(PermissionKey.isValid(key)).toBe(true);
    }
  });
});

describe('PermissionDescription', () => {
  it('normaliza: NFC, sem espaços nas pontas nem repetidos', () => {
    expect(PermissionDescription.create('  Aprovar\t faturas  ').value).toBe(
      'Aprovar faturas',
    );
    expect(PermissionDescription.create('Gerência').value).toBe('Gerência');
  });

  it('aceita de 1 a 200 caracteres, contando depois de normalizar', () => {
    expect(PermissionDescription.create('x').value).toBe('x');
    expect(PermissionDescription.create('é'.repeat(200)).value).toHaveLength(
      200,
    );
    expect(PermissionDescription.create('é'.repeat(200)).value).toBe(
      'é'.repeat(200),
    );
    for (const raw of ['', '   ', 'a'.repeat(201)]) {
      expect(() => PermissionDescription.create(raw)).toThrow(
        InvalidPermissionDescriptionError,
      );
    }
  });
});

describe('Recursos reservados', () => {
  it('são os do catálogo de sistema, mais invitations e permissions', () => {
    expect([...RESERVED_PERMISSION_RESOURCES].sort()).toEqual(
      [
        'audit',
        'integrations',
        'invitations',
        'members',
        'organizations',
        'permissions',
        'roles',
      ].sort(),
    );
  });

  it('todo recurso do catálogo de sistema está na lista', () => {
    for (const { key } of PERMISSION_CATALOG) {
      expect(RESERVED_PERMISSION_RESOURCES).toContain(resourceOf(key));
    }
  });

  it('permissions:manage está no catálogo, com descrição', () => {
    expect(
      PERMISSION_CATALOG.find((p) => p.key === 'permissions:manage')
        ?.description,
    ).toBeTruthy();
  });
});

describe('CustomPermission', () => {
  const create = (key: string, description = 'Aprovar faturas') =>
    CustomPermission.create({ organizationId: 'org-1', key, description }, NOW);

  it('cria com chave e descrição normalizada', () => {
    const permission = create('invoices:approve', '  Aprovar   faturas ');

    expect(permission).toMatchObject({
      organizationId: 'org-1',
      key: 'invoices:approve',
      description: 'Aprovar faturas',
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(permission.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each(RESERVED_PERMISSION_RESOURCES)(
    'recurso reservado %s: RESERVED_PERMISSION_RESOURCE',
    (resource) => {
      expect(() => create(`${resource}:approve`)).toThrow(
        ReservedPermissionResourceError,
      );
    },
  );

  it('recurso que só começa como um reservado é aceito', () => {
    expect(create('roles-extra:read').key).toBe('roles-extra:read');
    expect(create('membership:read').key).toBe('membership:read');
  });

  it('formato inválido: INVALID_PERMISSION_KEY; descrição vazia: INVALID_PERMISSION_DESCRIPTION', () => {
    expect(() => create('Invoices:Approve')).toThrow(InvalidPermissionKeyError);
    expect(() => create('invoices:approve', '  ')).toThrow(
      InvalidPermissionDescriptionError,
    );
  });

  it('changeDescription troca só a descrição; a mesma, normalizada, não muda nada', () => {
    const permission = create('invoices:approve');

    permission.changeDescription(' Aprovar  faturas ', LATER);
    expect(permission.updatedAt).toEqual(NOW);

    permission.changeDescription('Aprovar notas fiscais', LATER);
    expect(permission).toMatchObject({
      key: 'invoices:approve',
      description: 'Aprovar notas fiscais',
      updatedAt: LATER,
    });
    expect(() => permission.changeDescription('', LATER)).toThrow(
      InvalidPermissionDescriptionError,
    );
  });

  it.each(['id', 'organizationId'] as const)('restore exige %s', (field) => {
    expect(
      () =>
        CustomPermission.restore({
          id: 'perm-1',
          organizationId: 'org-1',
          key: 'invoices:approve',
          description: 'Aprovar',
          createdAt: NOW,
          updatedAt: NOW,
          [field]: ' ',
        }),
      // Dado corrompido no banco: Error comum (500), não DomainError (400).
    ).toThrow(
      /^CustomPermission inválido vindo do banco: INVALID_CUSTOM_PERMISSION: /,
    );
  });
});

describe('PermissionCatalog', () => {
  it('system(): só o catálogo de sistema, na ordem dele', () => {
    const catalog = PermissionCatalog.system();

    expect(catalog.keys).toEqual(SYSTEM);
    expect(catalog.has('invoices:approve')).toBe(false);
  });

  it('withCustom(): sistema primeiro, depois as personalizadas por chave, sem repetição', () => {
    const catalog = PermissionCatalog.withCustom([
      'invoices:approve',
      'contracts:sign',
      'invoices:approve',
      'invoices-items:read',
    ]);

    expect(catalog.keys).toEqual([
      ...SYSTEM,
      'contracts:sign',
      'invoices-items:read',
      'invoices:approve',
    ]);
    expect(catalog.has('contracts:sign')).toBe(true);
  });

  it('parsePermissions valida contra o catálogo efetivo', () => {
    const catalog = PermissionCatalog.withCustom(['invoices:approve']);

    expect(
      parsePermissions(
        ['invoices:approve', MEMBERS_READ, 'invoices:approve'],
        catalog,
      ),
    ).toEqual([MEMBERS_READ, 'invoices:approve']);
    expect(() =>
      parsePermissions(['invoices:approve'], PermissionCatalog.system()),
    ).toThrow(InvalidPermissionError);
    expect(() => parsePermissions(['contracts:sign'], catalog)).toThrow(
      InvalidPermissionError,
    );
  });
});

describe('Role com o catálogo efetivo', () => {
  const catalog = PermissionCatalog.withCustom([
    'invoices:approve',
    'contracts:sign',
  ]);
  const { owner, member } = Role.createDefaults('org-1', NOW);

  it('effectivePermissions: OWNER recebe sistema e personalizadas; os demais, as gravadas', () => {
    expect(owner.effectivePermissions(catalog)).toEqual(catalog.keys);
    expect(owner.effectivePermissions(PermissionCatalog.system())).toEqual(
      SYSTEM,
    );
    expect(member.effectivePermissions(catalog)).toEqual([MEMBERS_READ]);
  });

  it('create e setPermissions aceitam personalizadas do catálogo efetivo', () => {
    const role = Role.create(
      {
        organizationId: 'org-1',
        name: 'Financeiro',
        permissions: ['invoices:approve', MEMBERS_READ],
      },
      catalog,
      NOW,
    );
    expect(role.permissions).toEqual([MEMBERS_READ, 'invoices:approve']);
    expect(role.grants('invoices:approve')).toBe(true);

    role.setPermissions(['contracts:sign'], catalog, LATER);
    expect(role.permissions).toEqual(['contracts:sign']);
    expect(role.grants('invoices:approve')).toBe(false);
  });

  it('personalizada fora do catálogo efetivo: INVALID_PERMISSION', () => {
    expect(() =>
      Role.create(
        {
          organizationId: 'org-1',
          name: 'Financeiro',
          permissions: ['payments:refund'],
        },
        catalog,
        NOW,
      ),
    ).toThrow(InvalidPermissionError);
  });

  it('anti-escalada vale para as personalizadas: quem não tem não concede nem tira', () => {
    const manager = Role.create(
      {
        organizationId: 'org-1',
        name: 'Gestor',
        permissions: [ROLES_MANAGE, 'invoices:approve'],
      },
      catalog,
      NOW,
    );

    expect(() =>
      ensureCanCreateRole(manager, ['invoices:approve']),
    ).not.toThrow();
    expect(() => ensureCanCreateRole(manager, ['contracts:sign'])).toThrow(
      PrivilegeEscalationError,
    );
    expect(() =>
      ensureCanChangePermissions(manager, {
        before: ['contracts:sign'],
        after: [],
      }),
    ).toThrow(PrivilegeEscalationError);
    expect(() =>
      ensureCanCreateRole(owner, ['contracts:sign', 'invoices:approve']),
    ).not.toThrow();
  });
});
