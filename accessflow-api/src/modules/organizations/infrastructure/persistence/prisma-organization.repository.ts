import { Injectable } from '@nestjs/common';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { isUniqueViolation } from '@/shared/infrastructure/database/prisma-errors';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { OrganizationRepository } from '@/modules/organizations/domain/repositories/organization.repository';
import { SlugAlreadyTakenError } from '@/modules/organizations/domain/errors/slug-already-taken.error';
import { PrismaOrganizationMapper } from './mappers/prisma-organization.mapper';
import { PrismaMembershipMapper } from './mappers/prisma-membership.mapper';

@Injectable()
export class PrismaOrganizationRepository extends OrganizationRepository {
  constructor(
    private readonly clients: PrismaClientProvider,
    private readonly transactions: TransactionManager,
  ) {
    super();
  }

  async findById(id: string): Promise<Organization | null> {
    const record = await this.clients.current().organization.findUnique({
      where: { id },
    });
    return record ? PrismaOrganizationMapper.toDomain(record) : null;
  }

  async findByIds(ids: string[]): Promise<Organization[]> {
    if (ids.length === 0) {
      return [];
    }

    const records = await this.clients.current().organization.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return records.map(PrismaOrganizationMapper.toDomain);
  }

  async createWithOwner(
    organization: Organization,
    owner: Membership,
  ): Promise<void> {
    try {
      await this.transactions.run(async () => {
        const db = this.clients.current();
        await db.organization.create({
          data: PrismaOrganizationMapper.toPersistence(organization),
        });
        await db.membership.create({
          data: PrismaMembershipMapper.toPersistence(owner),
        });
      });
    } catch (error) {
      if (isUniqueViolation(error, 'slug')) throw new SlugAlreadyTakenError();
      throw error;
    }
  }

  async save(organization: Organization): Promise<void> {
    // Só o que a entidade permite alterar: regravar os outros campos
    // desfaria mudanças concorrentes feitas por outro caminho.
    const { id, name, status, updatedAt } =
      PrismaOrganizationMapper.toPersistence(organization);

    await this.clients.current().organization.update({
      where: {
        id,
      },
      data: { name, status, updatedAt },
    });
  }
}
