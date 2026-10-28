import { ClockPort } from '@/shared/application/ports/clock.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { CustomPermissionRepository } from '../../domain/repositories/custom-permission.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { OrganizationPermissionEntry } from '../dto/organization-permission-entry';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';
import { requireCustomPermission } from '../services/require-custom-permission';

export interface UpdatePermissionInput {
  cognitoSub: string;
  organizationId: string;
  /** Identifica a permissão; não muda. */
  key: string;
  description: string;
}

export class UpdatePermissionUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly customPermissions: CustomPermissionRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
    private readonly transactions: TransactionManager,
    private readonly clock: ClockPort,
  ) {}

  /** Só a descrição muda. */
  async execute(
    input: UpdatePermissionInput,
  ): Promise<OrganizationPermissionEntry> {
    const actorId = await this.users.getActiveUserId(input.cognitoSub);
    const organizationId = input.organizationId.toLowerCase();

    const permission = await this.transactions.run(async () => {
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
      permission.changeDescription(input.description, this.clock.now());

      await this.customPermissions.save(permission);
      return permission;
    });

    return {
      key: permission.key,
      description: permission.description,
      isSystem: false,
    };
  }
}
