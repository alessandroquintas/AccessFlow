import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { isUniqueViolation } from '@/shared/infrastructure/database/prisma-errors';
import { PrismaUserMapper } from './mappers/prisma-user.mapper';
import { UserAlreadyExistsError } from '../../domain/errors/user-already-exists.error';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly clients: PrismaClientProvider) {
    super();
  }

  async findByCognitoSub(cognitoSub: string): Promise<User | null> {
    const data = await this.clients.current().user.findUnique({
      where: {
        cognitoSub,
      },
    });

    return data ? PrismaUserMapper.toDomain(data) : null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }

    const records = await this.clients.current().user.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return records.map(PrismaUserMapper.toDomain);
  }

  async findByEmail(email: string): Promise<User[]> {
    const records = await this.clients.current().user.findMany({
      where: {
        email,
      },
    });

    return records.map(PrismaUserMapper.toDomain);
  }

  async create(user: User): Promise<void> {
    try {
      await this.clients.current().user.create({
        data: PrismaUserMapper.toPersistence(user),
      });
    } catch (error) {
      if (isUniqueViolation(error, 'cognito_sub')) {
        throw new UserAlreadyExistsError();
      }
      throw error;
    }
  }

  async save(user: User): Promise<void> {
    // Só o que a entidade permite alterar: regravar os outros campos
    // desfaria mudanças concorrentes, como uma desativação.
    const { id, name, updatedAt } = PrismaUserMapper.toPersistence(user);

    await this.clients.current().user.update({
      where: {
        id,
      },
      data: { name, updatedAt },
    });
  }
}
