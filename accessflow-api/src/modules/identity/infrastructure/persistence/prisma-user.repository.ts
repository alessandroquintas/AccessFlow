import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaUserMapper } from './mappers/prisma-user.mapper';

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
}
