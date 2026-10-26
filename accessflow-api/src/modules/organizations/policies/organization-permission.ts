import { MembershipRole } from '../domain/entities/membership.entity';

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

const ALL_PERMISSIONS = Object.values(OrganizationPermission);

/**
 * Permissões de cada papel fixo. Provisório até o RBAC da Fase 8,
 * quando os papéis e suas permissões passam a vir do banco.
 */

const PERMISSION_BY_ROLE: Record<
  MembershipRole,
  ReadonlySet<OrganizationPermission>
> = {
  OWNER: new Set(ALL_PERMISSIONS),
  MEMBER: new Set([OrganizationPermission.MEMBERS_READ]),
};

export function roleHasPermission(
  role: MembershipRole,
  permission: OrganizationPermission,
): boolean {
  return PERMISSION_BY_ROLE[role].has(permission);
}
