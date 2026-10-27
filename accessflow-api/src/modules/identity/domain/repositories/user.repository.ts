import { User } from '../entities/user.entity';

export abstract class UserRepository {
  abstract findByCognitoSub(cognitoSub: string): Promise<User | null>;
  abstract findByIds(ids: string[]): Promise<User[]>;
  /** O e-mail não é único: pode haver mais de um perfil com ele. */
  abstract findByEmail(email: string): Promise<User[]>;
  abstract create(user: User): Promise<void>;
  abstract save(user: User): Promise<void>;
}
