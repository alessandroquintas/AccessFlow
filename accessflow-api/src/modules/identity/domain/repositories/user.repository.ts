import { User } from '../entities/user.entity';

export abstract class UserRepository {
  abstract findByCognitoSub(cognitoSub: string): Promise<User | null>;
}
