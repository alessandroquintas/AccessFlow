import {
  Prisma,
  type CustomPermission as PrismaCustomPermission,
} from '@prisma/client';
import { CustomPermission } from '@/modules/organizations/domain/entities/custom-permission.entity';

export class PrismaCustomPermissionMapper {
  static toDomain(record: PrismaCustomPermission): CustomPermission {
    return CustomPermission.restore({
      id: record.id,
      organizationId: record.organizationId,
      key: record.key,
      description: record.description,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(
    permission: CustomPermission,
  ): Prisma.CustomPermissionUncheckedCreateInput {
    return {
      id: permission.id,
      organizationId: permission.organizationId,
      key: permission.key,
      description: permission.description,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
    };
  }
}
