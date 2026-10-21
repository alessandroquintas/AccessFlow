import { GetCurrentUserUseCase } from '@/modules/identity/application/use-cases/get-current-user.use-case';
import { UserDirectoryPort } from '../../application/ports/user-directory.port';
import { Injectable } from '@nestjs/common';

@Injectable()
export class IdentityUserDirectory extends UserDirectoryPort {
  constructor(private readonly getCurrentUser: GetCurrentUserUseCase) {
    super();
  }

  async getActiveUserId(cognitoSub: string): Promise<string> {
    const user = await this.getCurrentUser.execute(cognitoSub);

    return user.id;
  }
}
