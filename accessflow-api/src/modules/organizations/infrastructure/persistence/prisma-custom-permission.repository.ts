import { Injectable } from '@nestjs/common';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { isUniqueViolation } from '@/shared/infrastructure/database/prisma-errors';
import { CustomPermission } from '@/modules/organizations/domain/entities/custom-permission.entity';
import { PermissionKeyTakenError } from '@/modules/organizations/domain/errors/permission-key-taken.error';
import { CustomPermissionRepository } from '@/modules/organizations/domain/repositories/custom-permission.repository';
import { PrismaCustomPermissionMapper } from './mappers/prisma-custom-permission.mapper';

@Injectable()
export class PrismaCustomPermissionRepository extends CustomPermissionRepository {
  constructor(
    private readonly clients: PrismaClientProvider,
    private readonly transactions: TransactionManager,
  ) {
    super();
  }

  async listByOrganization(
    organizationId: string,
  ): Promise<CustomPermission[]> {
    const records = await this.clients.current().customPermission.findMany({
      where: { organizationId },
    });
    // Ordenado aqui, e não no ORDER BY: a collation do banco ignoraria o
    // hífen e a ordem não bateria com a do catálogo efetivo.
    return records
      .map(PrismaCustomPermissionMapper.toDomain)
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }

  async findByKey(
    organizationId: string,
    key: string,
  ): Promise<CustomPermission | null> {
    const record = await this.clients.current().customPermission.findUnique({
      where: { organizationId_key: { organizationId, key } },
    });
    return record ? PrismaCustomPermissionMapper.toDomain(record) : null;
  }

  async create(permission: CustomPermission): Promise<void> {
    try {
      await this.clients.current().customPermission.create({
        data: PrismaCustomPermissionMapper.toPersistence(permission),
      });
    } catch (error) {
      if (isUniqueViolation(error, 'key')) throw new PermissionKeyTakenError();
      throw error;
    }
  }

  async save(permission: CustomPermission): Promise<void> {
    const { id, description, updatedAt } =
      PrismaCustomPermissionMapper.toPersistence(permission);

    await this.clients.current().customPermission.update({
      where: { id },
      data: { description, updatedAt },
    });
  }

  async delete(permission: CustomPermission): Promise<void> {
    await this.transactions.run(async () => {
      const db = this.clients.current();
      // Só papéis apagados: se um papel ativo ainda tivesse a chave (quem
      // chama não checou isInUse), ele não perde a permissão em silêncio.
      await db.rolePermission.deleteMany({
        where: {
          permissionKey: permission.key,
          role: {
            organizationId: permission.organizationId,
            deletedAt: { not: null },
          },
        },
      });
      await db.customPermission.delete({ where: { id: permission.id } });
    });
  }

  async isInUse(organizationId: string, key: string): Promise<boolean> {
    // Percorre os papéis da organização pelo índice de roles e procura a
    // chave na PK de role_permissions (role_id, permission_key).
    const [{ inUse }] = await this.clients.current().$queryRaw<
      { inUse: boolean }[]
    >`
      SELECT EXISTS (
        SELECT 1
        FROM roles r
        JOIN role_permissions rp ON rp.role_id = r.id
        WHERE r.organization_id = ${organizationId}::uuid
          AND r.deleted_at IS NULL
          AND rp.permission_key = ${key}
      ) AS "inUse"`;
    return inUse;
  }
}
