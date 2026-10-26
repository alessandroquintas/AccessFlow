import { GetCurrentUserUseCase } from '@/modules/identity/application/use-cases/get-current-user.use-case';
import { GetUsersByIdsUseCase } from '@/modules/identity/application/use-cases/get-users-by-ids.use-case';
import {
  MemberProfile,
  UserDirectoryPort,
} from '../../application/ports/user-directory.port';
import { Injectable } from '@nestjs/common';

@Injectable()
export class IdentityUserDirectory extends UserDirectoryPort {
  constructor(
    private readonly getCurrentUser: GetCurrentUserUseCase,
    private readonly getUsersByIds: GetUsersByIdsUseCase,
  ) {
    super();
  }

  async getActiveUserId(cognitoSub: string): Promise<string> {
    const user = await this.getCurrentUser.execute(cognitoSub);

    return user.id;
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
