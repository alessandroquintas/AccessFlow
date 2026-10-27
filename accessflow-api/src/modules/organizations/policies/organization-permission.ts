/** Catálogo das permissões do sistema: a única fonte das chaves. */
export const OrganizationPermission = {
  ORGANIZATIONS_UPDATE: 'organizations:update',
  MEMBERS_READ: 'members:read',
  MEMBERS_INVITE: 'members:invite',
  MEMBERS_REMOVE: 'members:remove',
  ROLES_READ: 'roles:read',
  ROLES_MANAGE: 'roles:manage',
  AUDIT_READ: 'audit:read',
} as const;

export type OrganizationPermission =
  (typeof OrganizationPermission)[keyof typeof OrganizationPermission];

/**
 * Permissões com que o papel MEMBER de toda organização nasce. Depois de
 * criado, as dele passam a vir do banco. O OWNER não precisa de lista: tem
 * todas.
 */
export const DEFAULT_MEMBER_PERMISSIONS: readonly OrganizationPermission[] = [
  OrganizationPermission.MEMBERS_READ,
];
