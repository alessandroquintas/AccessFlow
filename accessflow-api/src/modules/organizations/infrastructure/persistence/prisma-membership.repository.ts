import { Injectable } from '@nestjs/common';
import {
  MembershipStatus as PrismaMembershipStatus,
  RoleSystemKey as PrismaRoleSystemKey,
} from '@prisma/client';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
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
    // Um item a mais indica se existe próxima página, sem precisar de count.
    const records = await this.clients.current().membership.findMany({
      where: {
        organizationId,
        status: PrismaMembershipStatus.ACTIVE,
        ...(after && {
          OR: [
            { createdAt: { gt: after.createdAt } },
            { createdAt: after.createdAt, id: { gt: after.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: first + 1,
    });

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

  async remove(membership: Membership, now: Date): Promise<void> {
    await this.transactions.run(async () => {
      const tx = this.clients.current();
      // Trava a organização: remoções concorrentes nela esperam aqui e só
      // contam os OWNERs depois que a anterior terminar.
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${membership.organizationId}::uuid FOR UPDATE`;

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
      if (isOwner) {
        const otherOwners = await tx.membership.count({
          where: { ...owner, id: { not: membership.id } },
        });
        if (otherOwners === 0) throw new LastOwnerError();
      }

      membership.remove(now);
      const { status, updatedAt } =
        PrismaMembershipMapper.toPersistence(membership);

      await tx.membership.update({
        where: { id: membership.id },
        data: { status, updatedAt },
      });
    });
  }
}
