import { InvalidPermissionError } from '../domain/errors/invalid-permission.error';

/** Catálogo das permissões do sistema: a única fonte das chaves. */
export const OrganizationPermission = {
  ORGANIZATIONS_UPDATE: 'organizations:update',
  MEMBERS_READ: 'members:read',
  MEMBERS_INVITE: 'members:invite',
  MEMBERS_REMOVE: 'members:remove',
  ROLES_READ: 'roles:read',
  ROLES_MANAGE: 'roles:manage',
  ROLES_ASSIGN: 'roles:assign',
  AUDIT_READ: 'audit:read',
} as const;

export type OrganizationPermission =
  (typeof OrganizationPermission)[keyof typeof OrganizationPermission];

export interface PermissionDefinition {
  key: OrganizationPermission;
  /** Texto curto exibido no front. */
  description: string;
}

const DESCRIPTION_BY_PERMISSION: Record<OrganizationPermission, string> = {
  'organizations:update': 'Editar os dados da organização',
  'members:read': 'Ver os membros',
  'members:invite': 'Convidar membros e revogar convites',
  'members:remove': 'Remover membros',
  'roles:read': 'Ver os papéis e suas permissões',
  'roles:manage': 'Criar, editar e apagar papéis',
  'roles:assign': 'Trocar o papel de um membro',
  'audit:read': 'Ver o registro de auditoria',
};

/** O catálogo como o front exibe, na ordem de OrganizationPermission. */
export const PERMISSION_CATALOG: readonly PermissionDefinition[] =
  Object.values(OrganizationPermission).map((key) => ({
    key,
    description: DESCRIPTION_BY_PERMISSION[key],
  }));

/**
 * Permissões com que o papel MEMBER de toda organização nasce. Depois de
 * criado, as dele passam a vir do banco. O OWNER não precisa de lista: tem
 * todas.
 */
export const DEFAULT_MEMBER_PERMISSIONS: readonly OrganizationPermission[] = [
  OrganizationPermission.MEMBERS_READ,
];

const PERMISSIONS: ReadonlySet<string> = new Set(
  Object.values(OrganizationPermission),
);

export function isOrganizationPermission(
  key: string,
): key is OrganizationPermission {
  return PERMISSIONS.has(key);
}

const CATALOG_POSITION: ReadonlyMap<string, number> = new Map(
  Object.values(OrganizationPermission).map((key, index) => [key, index]),
);

/**
 * Ordem estável para exibir e comparar: a do catálogo; chaves fora dele vão
 * para o fim, em ordem alfabética.
 */
export function sortPermissions(keys: readonly string[]): string[] {
  const position = (key: string) =>
    CATALOG_POSITION.get(key) ?? CATALOG_POSITION.size;
  return [...keys].sort(
    (a, b) => position(a) - position(b) || (a < b ? -1 : a > b ? 1 : 0),
  );
}

/**
 * Valida chaves vindas de fora: lança InvalidPermissionError na primeira
 * fora do catálogo e devolve as demais sem repetição, na ordem do catálogo.
 */
export function parsePermissions(
  keys: readonly string[],
): OrganizationPermission[] {
  const requested = new Set(keys);

  for (const key of requested) {
    if (!isOrganizationPermission(key)) throw new InvalidPermissionError(key);
  }

  return Object.values(OrganizationPermission).filter((key) =>
    requested.has(key),
  );
}
