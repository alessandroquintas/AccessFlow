import { User } from '@/modules/identity/domain/entities/user.entity';
import { UserRepository } from '@/modules/identity/domain/repositories/user.repository';

export class InMemoryUserRepository extends UserRepository {
  constructor(private readonly users: User[] = []) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findByCognitoSub(cognitoSub: string): Promise<User | null> {
    return this.users.find((user) => user.cognitoSub === cognitoSub) ?? null;
  }
}
