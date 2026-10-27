import { ClockPort } from '@/shared/application/ports/clock.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { isUuid } from '@/shared/domain/uuid';
import { MemberNotFoundError } from '../../domain/errors/member-not-found.error';
import { MembershipRepository } from '../../domain/repositories/membership.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { ensureCanAssignRole } from '../../policies/privilege-escalation';
import { OrganizationMember } from '../dto/organization-member';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';
import { requireRole } from '../services/require-role';

export interface AssignRoleInput {
  cognitoSub: string;
  organizationId: string;
  userId: string;
  roleId: string;
}

export class AssignRoleUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly memberships: MembershipRepository,
    private readonly roles: RoleRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
    private readonly transactions: TransactionManager,
    private readonly clock: ClockPort,
  ) {}

  /** Vale para o próprio autor: rebaixar-se é permitido; promover-se, não. */
  async execute(input: AssignRoleInput): Promise<OrganizationMember> {
    const actorId = await this.users.getActiveUserId(input.cognitoSub);
    const organizationId = input.organizationId.toLowerCase();

    const { membership, role } = await this.transactions.run(async () => {
      // Trava antes de checar: se o papel do autor perder roles:assign numa
      // escrita concorrente, ou ela termina antes e é vista aqui, ou espera.
      await this.organizations.lock(organizationId);
      const { role: actorRole } = await this.access.requirePermission(
        organizationId,
        actorId,
        OrganizationPermission.ROLES_ASSIGN,
      );

      const userId = input.userId.toLowerCase();
      if (!isUuid(userId)) throw new MemberNotFoundError();
      const membership = await this.memberships.findByOrganizationAndUser(
        organizationId,
        userId,
      );
      if (!membership?.isActive()) throw new MemberNotFoundError();

      const role = await requireRole(this.roles, organizationId, input.roleId);
      const current = await this.roles.findById(
        organizationId,
        membership.roleId,
      );
      if (!current)
        throw new Error('Membership sem papel ativo na organização.');

      // Antes da idempotência: quem não cobre o papel não recebe nem a
      // confirmação de que nada mudou.
      ensureCanAssignRole(actorRole, { from: current, to: role });

      if (membership.roleId !== role.id) {
        await this.memberships.changeRole(membership, role, this.clock.now());
      }
      return { membership, role };
    });

    const [profile] = await this.users.getProfilesByIds([membership.userId]);
    if (!profile) throw new Error('Membership sem perfil de usuário.');

    return { membership, profile, role };
  }
}
