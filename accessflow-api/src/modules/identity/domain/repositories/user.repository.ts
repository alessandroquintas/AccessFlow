import { User } from '../entities/user.entity';

export abstract class UserRepository {
  abstract findByCognitoSub(cognitoSub: string): Promise<User | null>;
  abstract findByIds(ids: string[]): Promise<User[]>;
  abstract create(user: User): Promise<void>;
  abstract save(user: User): Promise<void>;
}
