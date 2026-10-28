import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { PermissionInUseError } from '../../domain/errors/permission-in-use.error';
import { CustomPermissionRepository } from '../../domain/repositories/custom-permission.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';
import { requireCustomPermission } from '../services/require-custom-permission';

export interface DeletePermissionInput {
  cognitoSub: string;
  organizationId: string;
  key: string;
}

export class DeletePermissionUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly customPermissions: CustomPermissionRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
    private readonly transactions: TransactionManager,
  ) {}

  /** Definitivo. Chave de sistema responde PERMISSION_NOT_FOUND. */
  async execute(input: DeletePermissionInput): Promise<void> {
    const actorId = await this.users.getActiveUserId(input.cognitoSub);
    const organizationId = input.organizationId.toLowerCase();

    await this.transactions.run(async () => {
      // Com a organização travada, nenhum papel passa a conceder a chave
      // entre a checagem de uso e a exclusão.
      await this.organizations.lock(organizationId);
      await this.access.requirePermission(
        organizationId,
        actorId,
        OrganizationPermission.PERMISSIONS_MANAGE,
      );

      const permission = await requireCustomPermission(
        this.customPermissions,
        organizationId,
        input.key,
      );
      if (
        await this.customPermissions.isInUse(organizationId, permission.key)
      ) {
        throw new PermissionInUseError();
      }

      await this.customPermissions.delete(permission);
    });
  }
}
