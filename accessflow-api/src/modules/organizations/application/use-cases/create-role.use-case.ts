import { ClockPort } from '@/shared/application/ports/clock.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { Role } from '../../domain/entities/role.entity';
import { RoleLimitReachedError } from '../../domain/errors/role-limit-reached.error';
import { CustomPermissionRepository } from '../../domain/repositories/custom-permission.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { ensureCanCreateRole } from '../../policies/privilege-escalation';
import { OrganizationRole } from '../dto/organization-role';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { ensureRoleNameAvailable } from '../services/ensure-role-name-available';
import { loadPermissionCatalog } from '../services/load-permission-catalog';
import { OrganizationAccessService } from '../services/organization-access.service';

export interface CreateRoleInput {
  cognitoSub: string;
  organizationId: string;
  name: string;
  permissions: string[];
}

export class CreateRoleUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly roles: RoleRepository,
    private readonly customPermissions: CustomPermissionRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
    private readonly transactions: TransactionManager,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: CreateRoleInput): Promise<OrganizationRole> {
    const actorId = await this.users.getActiveUserId(input.cognitoSub);
    const organizationId = input.organizationId.toLowerCase();

    const role = await this.transactions.run(async () => {
      // Trava antes de checar: a permissão do autor, o catálogo efetivo, o
      // nome livre e o limite valem até o commit, porque toda escrita de
      // papel e de permissão personalizada trava a organização.
      await this.organizations.lock(organizationId);
      const { role: actorRole } = await this.access.requirePermission(
        organizationId,
        actorId,
        OrganizationPermission.ROLES_MANAGE,
      );

      const role = Role.create(
        {
          organizationId,
          name: input.name,
          permissions: input.permissions,
        },
        await loadPermissionCatalog(this.customPermissions, organizationId),
        this.clock.now(),
      );
      ensureCanCreateRole(actorRole, role.permissions);

      const activeRoles =
        await this.roles.listActiveByOrganization(organizationId);
      ensureRoleNameAvailable(activeRoles, role);
      const customRoles = activeRoles.filter((r) => !r.isSystem()).length;
      if (customRoles >= Role.MAX_CUSTOM_PER_ORGANIZATION) {
        throw new RoleLimitReachedError();
      }

      await this.roles.create(role);
      return role;
    });

    return { role, memberCount: 0 };
  }
}
