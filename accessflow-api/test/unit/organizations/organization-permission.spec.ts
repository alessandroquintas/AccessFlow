import { describe, expect, it } from 'vitest';
import { InvalidPermissionError } from '@/modules/organizations/domain/errors/invalid-permission.error';
import {
  PermissionCatalog,
  DEFAULT_MEMBER_PERMISSIONS,
  OrganizationPermission,
  PERMISSION_CATALOG,
  isOrganizationPermission,
  parsePermissions,
} from '@/modules/organizations/policies/organization-permission';

const { MEMBERS_READ, MEMBERS_INVITE, ROLES_READ, ROLES_ASSIGN } =
  OrganizationPermission;

describe('Catálogo de permissões', () => {
  it('tem as chaves de papéis', () => {
    expect(Object.values(OrganizationPermission)).toEqual(
      expect.arrayContaining(['roles:read', 'roles:manage', 'roles:assign']),
    );
  });

  it('uma entrada por chave, na ordem de OrganizationPermission, com descrição', () => {
    expect(PERMISSION_CATALOG.map((entry) => entry.key)).toEqual(
      Object.values(OrganizationPermission),
    );
    for (const { description } of PERMISSION_CATALOG) {
      expect(description.trim()).not.toBe('');
    }
  });

  it('o MEMBER continua nascendo só com members:read', () => {
    expect(DEFAULT_MEMBER_PERMISSIONS).toEqual([MEMBERS_READ]);
  });

  it('isOrganizationPermission só aceita chaves do catálogo, com a grafia exata', () => {
    expect(isOrganizationPermission('roles:assign')).toBe(true);
    expect(isOrganizationPermission('Roles:Assign')).toBe(false);
    expect(isOrganizationPermission('roles:assign ')).toBe(false);
    expect(isOrganizationPermission('billing:read')).toBe(false);
  });
});

describe('parsePermissions', () => {
  it('remove repetidas e devolve na ordem do catálogo', () => {
    expect(
      parsePermissions(
        [ROLES_ASSIGN, MEMBERS_READ, ROLES_ASSIGN, ROLES_READ],
        PermissionCatalog.system(),
      ),
    ).toEqual([MEMBERS_READ, ROLES_READ, ROLES_ASSIGN]);
  });

  it('conjunto vazio é válido', () => {
    expect(parsePermissions([], PermissionCatalog.system())).toEqual([]);
  });

  it.each([
    ['fora do catálogo', ['billing:read']],
    ['entre válidas', [MEMBERS_READ, 'members:delete', MEMBERS_INVITE]],
    ['com caixa diferente', ['MEMBERS:READ']],
    ['com espaço', [' members:read']],
    ['vazia', ['']],
  ])('recusa chave %s', (_, keys) => {
    expect(() => parsePermissions(keys, PermissionCatalog.system())).toThrow(
      InvalidPermissionError,
    );
  });

  it('a mensagem traz a chave recusada', () => {
    expect(() =>
      parsePermissions(['billing:read'], PermissionCatalog.system()),
    ).toThrow('Permissão fora do catálogo: "billing:read".');
  });
});
