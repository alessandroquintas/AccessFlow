import {
  Role,
  RoleSystemKey,
} from '@/modules/organizations/domain/entities/role.entity';

/**
 * Papel como a API pública o expõe (GraphQL e REST): o systemKey, ou CUSTOM
 * para papel personalizado. O papel completo vem em `assignedRole`.
 */
export const MembershipRole = {
  OWNER: 'OWNER',
  MEMBER: 'MEMBER',
  CUSTOM: 'CUSTOM',
} as const;

export type MembershipRole =
  (typeof MembershipRole)[keyof typeof MembershipRole];

const BY_SYSTEM_KEY: Record<RoleSystemKey, MembershipRole> = {
  OWNER: MembershipRole.OWNER,
  MEMBER: MembershipRole.MEMBER,
};

const SYSTEM_KEY_BY_ROLE: Record<MembershipRole, RoleSystemKey | null> = {
  OWNER: RoleSystemKey.OWNER,
  MEMBER: RoleSystemKey.MEMBER,
  CUSTOM: null,
};

export function membershipRoleOf(role: Role): MembershipRole {
  return role.systemKey === null
    ? MembershipRole.CUSTOM
    : BY_SYSTEM_KEY[role.systemKey];
}

/** CUSTOM não identifica um papel: devolve null. */
export function systemKeyOf(role: MembershipRole): RoleSystemKey | null {
  return SYSTEM_KEY_BY_ROLE[role];
}
