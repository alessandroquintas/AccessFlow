import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaUserMapper } from './mappers/prisma-user.mapper';
import { Prisma } from '@prisma/client';
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

    const result = data ? PrismaUserMapper.toDomain(data) : null;

    return result;
  }

  async create(user: User): Promise<void> {
    try {
      await this.prisma.user.create({
        data: PrismaUserMapper.toPersistence(user),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new UserAlreadyExistsError();
      }
      throw error;
    }
  }
}
