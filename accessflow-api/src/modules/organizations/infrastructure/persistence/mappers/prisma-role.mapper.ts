import {
  Prisma,
  RoleSystemKey as PrismaRoleSystemKey,
  type Role as PrismaRole,
} from '@prisma/client';
import {
  Role,
  RoleSystemKey,
} from '@/modules/organizations/domain/entities/role.entity';

/** Inclui as permissões gravadas junto do papel. */
export const ROLE_WITH_PERMISSIONS = {
  permissions: { select: { permissionKey: true } },
} satisfies Prisma.RoleInclude;

type PrismaRoleWithPermissions = PrismaRole & {
  permissions: { permissionKey: string }[];
};

const SYSTEM_KEY_TO_DOMAIN: Record<PrismaRoleSystemKey, RoleSystemKey> = {
  OWNER: RoleSystemKey.OWNER,
  MEMBER: RoleSystemKey.MEMBER,
};

const SYSTEM_KEY_TO_PERSISTENCE: Record<RoleSystemKey, PrismaRoleSystemKey> = {
  OWNER: PrismaRoleSystemKey.OWNER,
  MEMBER: PrismaRoleSystemKey.MEMBER,
};

export class PrismaRoleMapper {
  static toDomain(record: PrismaRoleWithPermissions): Role {
    return Role.restore({
      id: record.id,
      organizationId: record.organizationId,
      name: record.name,
      description: record.description,
      systemKey: record.systemKey && SYSTEM_KEY_TO_DOMAIN[record.systemKey],
      permissions: record.permissions.map((p) => p.permissionKey),
      deletedAt: record.deletedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  /** Só a linha de `roles`; as permissões vão em `role_permissions`. */
  static toPersistence(role: Role): Prisma.RoleUncheckedCreateInput {
    return {
      id: role.id,
      organizationId: role.organizationId,
      name: role.name,
      description: role.description,
      systemKey: role.systemKey && SYSTEM_KEY_TO_PERSISTENCE[role.systemKey],
      deletedAt: role.deletedAt,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
