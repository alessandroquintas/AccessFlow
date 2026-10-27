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

  async findByIds(ids: string[]): Promise<User[]> {
    return this.items.filter((user) => ids.includes(user.id));
  }

  async findByEmail(email: string): Promise<User[]> {
    return this.items.filter((user) => user.email === email);
  }

  async create(user: User): Promise<void> {
    if (this.items.some((item) => item.cognitoSub === user.cognitoSub)) {
      throw new UserAlreadyExistsError();
    }
    this.items.push(user);
  }

  async save(user: User): Promise<void> {
    const index = this.items.findIndex((item) => item.id === user.id);
    if (index >= 0) {
      this.items[index] = user;
    }
  }
}
