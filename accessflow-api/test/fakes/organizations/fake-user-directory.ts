import { UserDirectoryPort } from '@/modules/organizations/application/ports/user-directory.port';
import { UserNotFoundError } from '@/modules/identity/domain/errors/user-not-found.error';

export class FakeUserDirectory extends UserDirectoryPort {
  private readonly users = new Map<string, string>();

  register(cognitoSub: string, userId: string): void {
    this.users.set(cognitoSub, userId);
  }

  async getActiveUserId(cognitoSub: string): Promise<string> {
    const userId = this.users.get(cognitoSub);
    if (!userId) throw new UserNotFoundError();
    return userId;
  }
}
