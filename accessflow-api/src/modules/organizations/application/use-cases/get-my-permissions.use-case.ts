import { CustomPermissionRepository } from '../../domain/repositories/custom-permission.repository';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { loadPermissionCatalog } from '../services/load-permission-catalog';
import { OrganizationAccessService } from '../services/organization-access.service';

export interface GetMyPermissionsInput {
  cognitoSub: string;
  organizationId: string;
}

export class GetMyPermissionsUseCase {
  constructor(
    private readonly customPermissions: CustomPermissionRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
  ) {}

  /** Permissões efetivas do papel do usuário; o OWNER recebe o catálogo efetivo. */
  async execute(input: GetMyPermissionsInput): Promise<readonly string[]> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);

    const organizationId = input.organizationId.toLowerCase();
    const { role } = await this.access.requireMember(organizationId, userId);

    // Só leitura: sem trava. O OWNER recebe o catálogo efetivo inteiro.
    return role.effectivePermissions(
      await loadPermissionCatalog(this.customPermissions, organizationId),
    );
  }
}
