import { User } from '../../domain/entities/user.entity';
import { UserRepository } from '../../domain/repositories/user.repository';
import { GetCurrentUserUseCase } from './get-current-user.use-case';

export interface UpdateMyProfileInput {
  cognitoSub: string;
  name: string;
}

export class UpdateMyProfileUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly getCurrentUser: GetCurrentUserUseCase,
  ) {}

  async execute(input: UpdateMyProfileInput): Promise<User> {
    // Mesmas regras do `me`: o perfil precisa existir e estar ativo.
    const user = await this.getCurrentUser.execute(input.cognitoSub);

    user.rename(input.name);
    await this.users.save(user);

    return user;
  }
}
