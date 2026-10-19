import { User } from '../../domain/entities/user.entity';
import { UserAlreadyExistsError } from '../../domain/errors/user-already-exists.error';
import { UserInactiveError } from '../../domain/errors/user-inactive.error';
import { UserRepository } from '../../domain/repositories/user.repository';
import { EmailNotVerifiedError } from '../errors/email-not-verified.error';
import { InvalidAccessTokenError } from '../errors/invalid-access-token.error';
import { IdentityProfilePort } from '../ports/identity-profile.port';

export interface ProvisionUserInput {
  cognitoSub: string;
  accessToken: string;
  name: string;
}

export class ProvisionUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly identityProfile: IdentityProfilePort,
  ) {}

  async execute(input: ProvisionUserInput): Promise<any> {
    const existing = await this.users.findByCognitoSub(input.cognitoSub);
    if (existing) return this.ensureActive(existing);

    const profile = await this.identityProfile.getProfile(input.accessToken);

    if (profile.sub !== input.cognitoSub) {
      throw new InvalidAccessTokenError();
    }

    if (!profile.emailVerified) {
      throw new EmailNotVerifiedError();
    }

    const user = User.create({
      cognitoSub: input.cognitoSub,
      name: input.name,
      email: profile.email,
    });

    try {
      await this.users.create(user);

      return user;
    } catch (error) {
      if (!(error instanceof UserAlreadyExistsError)) throw error;

      // Outra requisição criou o perfil entre a busca e o insert.
      const created = await this.users.findByCognitoSub(input.cognitoSub);
      if (!created) {
        throw error;
      }

      return this.ensureActive(created);
    }
  }

  private ensureActive(user: User): User {
    if (!user.isActive) {
      throw new UserInactiveError();
    }

    return user;
  }
}
