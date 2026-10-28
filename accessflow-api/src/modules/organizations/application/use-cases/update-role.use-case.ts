import { ClockPort } from '@/shared/application/ports/clock.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { CustomPermissionRepository } from '../../domain/repositories/custom-permission.repository';
import { MembershipRepository } from '../../domain/repositories/membership.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { ensureCanChangePermissions } from '../../policies/privilege-escalation';
import { OrganizationRole } from '../dto/organization-role';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { ensureRoleNameAvailable } from '../services/ensure-role-name-available';
import { loadPermissionCatalog } from '../services/load-permission-catalog';
import { OrganizationAccessService } from '../services/organization-access.service';
import { requireRole } from '../services/require-role';

export interface UpdateRoleInput {
  cognitoSub: string;
  organizationId: string;
  roleId: string;
  /** Ausente: o nome não muda. */
  name?: string;
  /** Ausente: as permissões não mudam. Presente: substitui todas. */
  permissions?: string[];
}

export class UpdateRoleUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly roles: RoleRepository,
    private readonly memberships: MembershipRepository,
    private readonly customPermissions: CustomPermissionRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
    private readonly transactions: TransactionManager,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: UpdateRoleInput): Promise<OrganizationRole> {
    const actorId = await this.users.getActiveUserId(input.cognitoSub);
    const organizationId = input.organizationId.toLowerCase();

    const role = await this.transactions.run(async () => {
      // Trava antes de checar, como nas demais escritas de papel.
      await this.organizations.lock(organizationId);
      const { role: actorRole } = await this.access.requirePermission(
        organizationId,
        actorId,
        OrganizationPermission.ROLES_MANAGE,
      );

      const role = await requireRole(this.roles, organizationId, input.roleId);
      const now = this.clock.now();

      if (input.name !== undefined) {
        const previous = role.name;
        role.rename(input.name, now);
        if (role.name !== previous) {
          ensureRoleNameAvailable(
            await this.roles.listActiveByOrganization(organizationId),
            role,
          );
        }
      }

      if (input.permissions !== undefined) {
        const before = role.permissions;
        // Lido com a organização travada: uma exclusão concorrente da
        // permissão ou termina antes e é vista aqui, ou espera.
        const catalog = await loadPermissionCatalog(
          this.customPermissions,
          organizationId,
        );
        role.setPermissions(input.permissions, catalog, now);
        ensureCanChangePermissions(actorRole, {
          before,
          after: role.permissions,
        });
      }

      await this.roles.save(role);
      return role;
    });

    const counts = await this.memberships.countActiveByRole(organizationId);
    return { role, memberCount: counts.get(role.id) ?? 0 };
  }
}
