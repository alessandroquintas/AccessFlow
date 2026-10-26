import {
  MemberProfile,
  UserDirectoryPort,
} from '@/modules/organizations/application/ports/user-directory.port';
import { UserNotFoundError } from '@/modules/identity/domain/errors/user-not-found.error';
import { UserInactiveError } from '@/modules/identity/domain/errors/user-inactive.error';

export class FakeUserDirectory extends UserDirectoryPort {
  private readonly users = new Map<string, string>();
  private readonly profiles = new Map<string, MemberProfile>();

  register(
    cognitoSub: string,
    userId: string,
    profile: { name?: string; email?: string; active?: boolean } = {},
  ): void {
    this.users.set(cognitoSub, userId);
    this.profiles.set(userId, {
      id: userId,
      name: profile.name ?? cognitoSub,
      email: profile.email ?? `${cognitoSub}@example.com`,
      active: profile.active ?? true,
    });
  }

  async getActiveUserId(cognitoSub: string): Promise<string> {
    const userId = this.users.get(cognitoSub);
    if (!userId) throw new UserNotFoundError();
    if (!this.profiles.get(userId)?.active) throw new UserInactiveError();
    return userId;
  }

  async getProfilesByIds(ids: string[]): Promise<MemberProfile[]> {
    return [...this.profiles.values()].filter((profile) =>
      ids.includes(profile.id),
    );
  }
}
