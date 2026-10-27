import { ClockPort } from '@/shared/application/ports/clock.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { RoleInUseError } from '../../domain/errors/role-in-use.error';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';
import { requireRole } from '../services/require-role';

export interface DeleteRoleInput {
  cognitoSub: string;
  organizationId: string;
  roleId: string;
}

export class DeleteRoleUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly roles: RoleRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
    private readonly transactions: TransactionManager,
    private readonly clock: ClockPort,
  ) {}

  /** Soft delete; o papel some das listagens e não pode mais ser usado. */
  async execute(input: DeleteRoleInput): Promise<void> {
    const actorId = await this.users.getActiveUserId(input.cognitoSub);
    const organizationId = input.organizationId.toLowerCase();

    await this.transactions.run(async () => {
      // Com a organização travada, nenhum convite, aceite ou atribuição passa
      // a usar o papel entre a checagem de uso e a exclusão.
      await this.organizations.lock(organizationId);
      await this.access.requirePermission(
        organizationId,
        actorId,
        OrganizationPermission.ROLES_MANAGE,
      );

      const role = await requireRole(this.roles, organizationId, input.roleId);
      role.softDelete(this.clock.now());

      if (await this.roles.isInUse(role.id)) throw new RoleInUseError();

      await this.roles.save(role);
    });
  }
}
