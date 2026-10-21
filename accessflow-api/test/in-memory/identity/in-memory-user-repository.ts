import { User } from '@/modules/identity/domain/entities/user.entity';
import { UserAlreadyExistsError } from '@/modules/identity/domain/errors/user-already-exists.error';
import { UserRepository } from '@/modules/identity/domain/repositories/user.repository';

export class InMemoryUserRepository extends UserRepository {
  public items: User[];
  constructor(users: User[] = []) {
    super();
    this.items = [...users];
  }

  async findByCognitoSub(cognitoSub: string): Promise<User | null> {
    return this.items.find((user) => user.cognitoSub === cognitoSub) ?? null;
  }

  async create(user: User): Promise<void> {
    if (this.items.some((item) => item.cognitoSub === user.cognitoSub)) {
      throw new UserAlreadyExistsError();
    }
    this.items.push(user);
  }
}
