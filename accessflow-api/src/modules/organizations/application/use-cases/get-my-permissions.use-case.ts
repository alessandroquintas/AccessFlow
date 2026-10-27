import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';

export interface GetMyPermissionsInput {
  cognitoSub: string;
  organizationId: string;
}

export class GetMyPermissionsUseCase {
  constructor(
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
  ) {}

  /** Permissões efetivas do papel do usuário; o OWNER recebe o catálogo. */
  async execute(input: GetMyPermissionsInput): Promise<readonly string[]> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);

    const { role } = await this.access.requireMember(
      input.organizationId.toLowerCase(),
      userId,
    );

    return role.effectivePermissions();
  }
}
