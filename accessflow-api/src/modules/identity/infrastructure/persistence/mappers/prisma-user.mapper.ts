import {
  User,
  UserStatus,
} from '@/modules/identity/domain/entities/user.entity';
import type { User as PrismaUser } from '@prisma/client';

export class PrismaUserMapper {
  static toDomain(data: PrismaUser): User {
    return User.restore({
      id: data.id,
      cognitoSub: data.cognitoSub,
      name: data.name,
      email: data.email,
      status: PrismaUserMapper.toDomainStatus(data.status),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  static toPersistence(user: User) {
    return {
      id: user.id,
      cognitoSub: user.cognitoSub,
      name: user.name,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private static toDomainStatus(status: PrismaUser['status']): UserStatus {
    switch (status) {
      case 'ACTIVE':
        return UserStatus.ACTIVE;
      case 'INACTIVE':
        return UserStatus.INACTIVE;
    }
  }
}
