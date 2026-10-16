import {
  User,
  UserStatus,
} from '@/modules/identity/domain/entities/user.entity';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(UserStatus, { name: 'UserStatus' });

@ObjectType('User')
export class UserType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field(() => UserStatus)
  status!: UserStatus;

  @Field()
  createdAt!: Date;

  static fromDomain(user: User): UserType {
    const type = new UserType();
    type.id = user.id;
    type.name = user.name;
    type.email = user.email;
    type.status = user.status;
    type.createdAt = user.createdAt;

    return type;
  }
}
