import {
  Role,
  RoleSystemKey,
} from '@/modules/organizations/domain/entities/role.entity';

/**
 * Papel como a API pública o expõe (GraphQL e REST). Nesta fase todo papel
 * é de sistema, então o valor sai do systemKey.
 */
export const MembershipRole = {
  OWNER: 'OWNER',
  MEMBER: 'MEMBER',
} as const;

export type MembershipRole =
  (typeof MembershipRole)[keyof typeof MembershipRole];

const BY_SYSTEM_KEY: Record<RoleSystemKey, MembershipRole> = {
  OWNER: MembershipRole.OWNER,
  MEMBER: MembershipRole.MEMBER,
};

const SYSTEM_KEY_BY_ROLE: Record<MembershipRole, RoleSystemKey> = {
  OWNER: RoleSystemKey.OWNER,
  MEMBER: RoleSystemKey.MEMBER,
};

export function membershipRoleOf(role: Role): MembershipRole {
  if (role.systemKey === null) {
    // Papéis customizados ganham representação na API na Fase 8b.
    throw new Error(`Papel sem systemKey não tem MembershipRole: ${role.id}`);
  }
  return BY_SYSTEM_KEY[role.systemKey];
}

export function systemKeyOf(role: MembershipRole): RoleSystemKey {
  return SYSTEM_KEY_BY_ROLE[role];
}
