import { User } from '../../domain/entities/user.entity';
import { UserInactiveError } from '../../domain/errors/user-inactive.error';
import { UserNotFoundError } from '../../domain/errors/user-not-found.error';
import { UserRepository } from '../../domain/repositories/user.repository';

export class GetCurrentUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(cognitoSub: string): Promise<User> {
    const user = await this.userRepository.findByCognitoSub(cognitoSub);

    if (!user) {
      throw new UserNotFoundError();
    }

    if (!user.isActive()) {
      throw new UserInactiveError();
    }

    return user;
  }
}
