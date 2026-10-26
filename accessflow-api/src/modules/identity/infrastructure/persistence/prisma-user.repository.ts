import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { isUniqueViolation } from '@/shared/infrastructure/database/prisma-errors';
import { PrismaUserMapper } from './mappers/prisma-user.mapper';
import { UserAlreadyExistsError } from '../../domain/errors/user-already-exists.error';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByCognitoSub(cognitoSub: string): Promise<User | null> {
    const data = await this.prisma.user.findUnique({
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

    const records = await this.prisma.user.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return records.map(PrismaUserMapper.toDomain);
  }

  async create(user: User): Promise<void> {
    try {
      await this.prisma.user.create({
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
    const { id, ...data } = PrismaUserMapper.toPersistence(user);

    await this.prisma.user.update({
      where: {
        id,
      },
      data,
    });
  }
}
