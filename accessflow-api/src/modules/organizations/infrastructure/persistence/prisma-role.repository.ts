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

  async listActiveByOrganization(organizationId: string): Promise<Role[]> {
    const records = await this.clients.current().role.findMany({
      where: { organizationId, deletedAt: null },
      include: ROLE_WITH_PERMISSIONS,
    });
    return records.map(PrismaRoleMapper.toDomain);
  }

  async createDefaults({ owner, member }: DefaultRoles): Promise<void> {
    await this.transactions.run(async () => {
      for (const role of [owner, member]) {
        await this.insert(role);
      }
    });
  }

  async create(role: Role): Promise<void> {
    await this.transactions.run(() => this.insert(role));
  }

  async save(role: Role): Promise<void> {
    await this.transactions.run(async () => {
      const db = this.clients.current();
      const { name, deletedAt, updatedAt } =
        PrismaRoleMapper.toPersistence(role);

      await db.role.update({
        where: { id: role.id },
        data: { name, deletedAt, updatedAt },
      });
      // Só a diferença: tira as que saíram e acrescenta as que entraram.
      await db.rolePermission.deleteMany({
        where: {
          roleId: role.id,
          permissionKey: { notIn: [...role.permissions] },
        },
      });
      if (role.permissions.length > 0) {
        await db.rolePermission.createMany({
          data: this.permissionRows(role),
          skipDuplicates: true,
        });
      }
    });
  }

  async isInUse(roleId: string): Promise<boolean> {
    // Uma única consulta, e não duas: no READ COMMITTED cada comando vê um
    // snapshot só, então o aceite (convite PENDING → membership ACTIVE, numa
    // transação) aparece de um lado ou do outro, nunca em nenhum.
    const [{ inUse }] = await this.clients.current().$queryRaw<
      { inUse: boolean }[]
    >`
      SELECT EXISTS (
               SELECT 1 FROM memberships
               WHERE role_id = ${roleId}::uuid AND status = 'ACTIVE'
             )
          OR EXISTS (
               SELECT 1 FROM invitations
               WHERE role_id = ${roleId}::uuid AND status = 'PENDING'
             ) AS "inUse"`;
    return inUse;
  }

  private async insert(role: Role): Promise<void> {
    const db = this.clients.current();
    await db.role.create({ data: PrismaRoleMapper.toPersistence(role) });
    if (role.permissions.length === 0) return;
    await db.rolePermission.createMany({ data: this.permissionRows(role) });
  }

  private permissionRows(role: Role) {
    return role.permissions.map((permissionKey) => ({
      roleId: role.id,
      permissionKey,
    }));
  }
}
