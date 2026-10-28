import { CustomPermissionRepository } from '../../domain/repositories/custom-permission.repository';
import {
  OrganizationPermission,
  PERMISSION_CATALOG,
} from '../../policies/organization-permission';
import { OrganizationPermissionEntry } from '../dto/organization-permission-entry';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';

export interface ListOrganizationPermissionsInput {
  cognitoSub: string;
  organizationId: string;
}

export class ListOrganizationPermissionsUseCase {
  constructor(
    private readonly customPermissions: CustomPermissionRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
  ) {}

  /** Catálogo efetivo: sistema na ordem do catálogo, depois personalizadas por chave. */
  async execute(
    input: ListOrganizationPermissionsInput,
  ): Promise<OrganizationPermissionEntry[]> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);
    const organizationId = input.organizationId.toLowerCase();

    await this.access.requirePermission(
      organizationId,
      userId,
      OrganizationPermission.ROLES_READ,
    );

    const custom =
      await this.customPermissions.listByOrganization(organizationId);

    return [
      ...PERMISSION_CATALOG.map(({ key, description }) => ({
        key,
        description,
        isSystem: true,
      })),
      ...custom.map(({ key, description }) => ({
        key,
        description,
        isSystem: false,
      })),
    ];
  }
}
