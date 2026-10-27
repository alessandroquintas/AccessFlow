import { GetCurrentUserUseCase } from '@/modules/identity/application/use-cases/get-current-user.use-case';
import { GetUsersByIdsUseCase } from '@/modules/identity/application/use-cases/get-users-by-ids.use-case';
import { GetUserIdsByEmailUseCase } from '@/modules/identity/application/use-cases/get-user-ids-by-email.use-case';
import {
  ActiveUser,
  MemberProfile,
  UserDirectoryPort,
} from '../../application/ports/user-directory.port';
import { Injectable } from '@nestjs/common';

@Injectable()
export class IdentityUserDirectory extends UserDirectoryPort {
  constructor(
    private readonly getCurrentUser: GetCurrentUserUseCase,
    private readonly getUsersByIds: GetUsersByIdsUseCase,
    private readonly userIdsByEmail: GetUserIdsByEmailUseCase,
  ) {
    super();
  }

  async getActiveUserId(cognitoSub: string): Promise<string> {
    const user = await this.getCurrentUser.execute(cognitoSub);

    return user.id;
  }

  async getActiveUser(cognitoSub: string): Promise<ActiveUser> {
    const user = await this.getCurrentUser.execute(cognitoSub);

    return { id: user.id, email: user.email };
  }

  async getUserIdsByEmail(email: string): Promise<string[]> {
    return this.userIdsByEmail.execute(email);
  }

  async getProfilesByIds(ids: string[]): Promise<MemberProfile[]> {
    const users = await this.getUsersByIds.execute(ids);

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      active: user.isActive(),
    }));
  }
}
