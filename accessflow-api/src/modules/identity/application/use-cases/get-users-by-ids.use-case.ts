import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';

export class GetUsersByIdsUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(ids: string[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.users.findByIds([...new Set(ids)]);
  }
}
