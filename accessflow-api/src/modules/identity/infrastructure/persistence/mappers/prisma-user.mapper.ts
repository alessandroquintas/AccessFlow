import {
  Prisma,
  UserStatus as PrismaUserStatus,
  type User as PrismaUser,
} from '@prisma/client';
import {
  User,
  UserStatus,
} from '@/modules/identity/domain/entities/user.entity';

const STATUS_TO_DOMAIN: Record<PrismaUserStatus, UserStatus> = {
  ACTIVE: UserStatus.ACTIVE,
  INACTIVE: UserStatus.INACTIVE,
};

const STATUS_TO_PERSISTENCE: Record<UserStatus, PrismaUserStatus> = {
  ACTIVE: PrismaUserStatus.ACTIVE,
  INACTIVE: PrismaUserStatus.INACTIVE,
};

export class PrismaUserMapper {
  static toDomain(record: PrismaUser): User {
    return User.restore({
      id: record.id,
      cognitoSub: record.cognitoSub,
      name: record.name,
      email: record.email,
      status: STATUS_TO_DOMAIN[record.status],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(user: User): Prisma.UserUncheckedCreateInput {
    return {
      id: user.id,
      cognitoSub: user.cognitoSub,
      name: user.name,
      email: user.email,
      status: STATUS_TO_PERSISTENCE[user.status],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
