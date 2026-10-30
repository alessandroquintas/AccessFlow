import { Injectable } from '@nestjs/common';
import {
  Prisma,
  MembershipStatus as PrismaMembershipStatus,
  RoleSystemKey as PrismaRoleSystemKey,
  type Membership as PrismaMembership,
} from '@prisma/client';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { Role } from '@/modules/organizations/domain/entities/role.entity';
import { LastOwnerError } from '@/modules/organizations/domain/errors/last-owner.error';
import {
  MembershipCursor,
  MembershipPage,
  MembershipRepository,
} from '@/modules/organizations/domain/repositories/membership.repository';
import { PrismaMembershipMapper } from './mappers/prisma-membership.mapper';

@Injectable()
export class PrismaMembershipRepository extends MembershipRepository {
  constructor(
    private readonly clients: PrismaClientProvider,
    private readonly transactions: TransactionManager,
  ) {
    super();
  }

  async findByOrganizationAndUser(
    organizationId: string,
    userId: string,
  ): Promise<Membership | null> {
    const record = await this.clients.current().membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });
    return record ? PrismaMembershipMapper.toDomain(record) : null;
  }

  async listActiveByUser(userId: string): Promise<Membership[]> {
    const records = await this.clients.current().membership.findMany({
      where: {
        userId,
        status: PrismaMembershipStatus.ACTIVE,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    return records.map(PrismaMembershipMapper.toDomain);
  }

  async listActiveByOrganization(
    organizationId: string,
    { first, after }: { first: number; after?: MembershipCursor },
  ): Promise<MembershipPage> {
    // Comparação de linha, como no auditEvents, e não o OR de antes: o
    // cursor entra no Index Cond de (organization_id, created_at, id) e a
    // página começa direto nele.
    const cursor = after
      ? Prisma.sql`AND (created_at, id) > (${after.createdAt}::timestamptz, ${after.id}::uuid)`
      : Prisma.empty;

    // Um item a mais indica se existe próxima página, sem precisar de count.
    const records = await this.clients.current().$queryRaw<PrismaMembership[]>`
      SELECT id,
             organization_id AS "organizationId",
             user_id AS "userId",
             role_id AS "roleId",
             status,
             created_at AS "createdAt",
             updated_at AS "updatedAt"
      FROM memberships
      WHERE organization_id = ${organizationId}::uuid
        AND status = ${PrismaMembershipStatus.ACTIVE}::"MembershipStatus"
        ${cursor}
      ORDER BY created_at, id
      LIMIT ${first + 1}`;

    return {
      items: records.slice(0, first).map(PrismaMembershipMapper.toDomain),
      hasNextPage: records.length > first,
    };
  }

  async create(membership: Membership): Promise<void> {
    await this.clients.current().membership.create({
      data: PrismaMembershipMapper.toPersistence(membership),
    });
  }

  async countActiveByRole(
    organizationId: string,
  ): Promise<Map<string, number>> {
    const groups = await this.clients.current().membership.groupBy({
      by: ['roleId'],
      where: { organizationId, status: PrismaMembershipStatus.ACTIVE },
      _count: { _all: true },
    });
    return new Map(groups.map((group) => [group.roleId, group._count._all]));
  }

  async changeRole(
    membership: Membership,
    role: Role,
    now: Date,
  ): Promise<void> {
    await this.transactions.run(async () => {
      const tx = this.clients.current();
      // Trava a organização, como o remove: trocas e remoções concorrentes
      // nela esperam aqui e só contam os OWNERs depois da anterior.
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${membership.organizationId}::uuid FOR UPDATE`;

      if (!role.isOwner()) await this.ensureNotLastOwner(membership);

      membership.changeRole(role.id, now);
      const { roleId, updatedAt } =
        PrismaMembershipMapper.toPersistence(membership);

      await tx.membership.update({
        where: { id: membership.id },
        data: { roleId, updatedAt },
      });
    });
  }

  async remove(membership: Membership, now: Date): Promise<void> {
    await this.transactions.run(async () => {
      const tx = this.clients.current();
      // Trava a organização: remoções concorrentes nela esperam aqui e só
      // contam os OWNERs depois que a anterior terminar.
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${membership.organizationId}::uuid FOR UPDATE`;

      await this.ensureNotLastOwner(membership);

      membership.remove(now);
      const { status, updatedAt } =
        PrismaMembershipMapper.toPersistence(membership);

      await tx.membership.update({
        where: { id: membership.id },
        data: { status, updatedAt },
      });
    });
  }

  /**
   * LastOwnerError se o membership for o último OWNER ativo da organização.
   * Lê o papel no banco, e não na entidade: chamar com a organização travada.
   */
  private async ensureNotLastOwner(membership: Membership): Promise<void> {
    const tx = this.clients.current();
    // OWNER é o membership ativo cujo papel tem systemKey OWNER.
    const owner = {
      organizationId: membership.organizationId,
      status: PrismaMembershipStatus.ACTIVE,
      role: { systemKey: PrismaRoleSystemKey.OWNER },
    };
    const isOwner =
      membership.isActive() &&
      (await tx.membership.count({
        where: { ...owner, id: membership.id },
      })) > 0;
    if (!isOwner) return;

    const otherOwners = await tx.membership.count({
      where: { ...owner, id: { not: membership.id } },
    });
    if (otherOwners === 0) throw new LastOwnerError();
  }
}
