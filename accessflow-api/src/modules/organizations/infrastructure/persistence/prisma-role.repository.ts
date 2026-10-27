import { Injectable } from '@nestjs/common';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import {
  DefaultRoles,
  Role,
  RoleSystemKey,
} from '@/modules/organizations/domain/entities/role.entity';
import { RoleRepository } from '@/modules/organizations/domain/repositories/role.repository';
import {
  PrismaRoleMapper,
  ROLE_WITH_PERMISSIONS,
} from './mappers/prisma-role.mapper';

@Injectable()
export class PrismaRoleRepository extends RoleRepository {
  constructor(
    private readonly clients: PrismaClientProvider,
    private readonly transactions: TransactionManager,
  ) {
    super();
  }

  async findById(organizationId: string, id: string): Promise<Role | null> {
    const record = await this.clients.current().role.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: ROLE_WITH_PERMISSIONS,
    });
    return record ? PrismaRoleMapper.toDomain(record) : null;
  }

  async findSystemRole(
    organizationId: string,
    systemKey: RoleSystemKey,
  ): Promise<Role | null> {
    const record = await this.clients.current().role.findFirst({
      where: { organizationId, systemKey, deletedAt: null },
      include: ROLE_WITH_PERMISSIONS,
    });
    return record ? PrismaRoleMapper.toDomain(record) : null;
  }

  async findByIds(ids: string[]): Promise<Role[]> {
    if (ids.length === 0) {
      return [];
    }

    const records = await this.clients.current().role.findMany({
      where: { id: { in: ids } },
      include: ROLE_WITH_PERMISSIONS,
    });
    return records.map(PrismaRoleMapper.toDomain);
  }

  async createDefaults({ owner, member }: DefaultRoles): Promise<void> {
    await this.transactions.run(async () => {
      const db = this.clients.current();
      for (const role of [owner, member]) {
        await db.role.create({ data: PrismaRoleMapper.toPersistence(role) });
        if (role.permissions.length === 0) continue;
        await db.rolePermission.createMany({
          data: role.permissions.map((permissionKey) => ({
            roleId: role.id,
            permissionKey,
          })),
        });
      }
    });
  }
}
