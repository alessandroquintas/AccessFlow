import { ClockPort } from '@/shared/application/ports/clock.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { Invitation } from '../../domain/entities/invitation.entity';
import { Role, RoleSystemKey } from '../../domain/entities/role.entity';
import { AlreadyMemberError } from '../../domain/errors/already-member.error';
import { InvalidInvitationError } from '../../domain/errors/invalid-invitation.error';
import { InvitationRepository } from '../../domain/repositories/invitation.repository';
import { MembershipRepository } from '../../domain/repositories/membership.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { ensureCanInviteWithRole } from '../../policies/privilege-escalation';
import { OrganizationInvitation } from '../dto/organization-invitation';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { describeInvitations } from '../services/describe-invitations';
import { OrganizationAccessService } from '../services/organization-access.service';
import { requireRole } from '../services/require-role';

/** Proteção contra abuso; convites expirados não ocupam vaga. */
export const MAX_PENDING_INVITATIONS_PER_ORGANIZATION = 50;

const ROLE_OR_ROLE_ID = 'Informe role ou roleId, só um deles.';

export interface InviteMemberInput {
  cognitoSub: string;
  organizationId: string;
  email: string;
  /**
   * Papel que o convidado recebe ao aceitar: um papel de sistema por
   * `role` ou qualquer papel da organização por `roleId`. Exatamente um dos
   * dois; senão, InvalidInvitationError.
   */
  role?: RoleSystemKey | null;
  roleId?: string | null;
}

export class InviteMemberUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly invitations: InvitationRepository,
    private readonly memberships: MembershipRepository,
    private readonly roles: RoleRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
    private readonly transactions: TransactionManager,
    private readonly clock: ClockPort,
  ) {}

  /** Cria o convite ou renova o pendente para o mesmo e-mail. */
  async execute(input: InviteMemberInput): Promise<OrganizationInvitation> {
    const actorId = await this.users.getActiveUserId(input.cognitoSub);
    const organizationId = input.organizationId.toLowerCase();

    const invitation = await this.transactions.run(async () => {
      // Trava antes de checar: se o papel do autor perder members:invite numa
      // escrita concorrente, ou ela termina antes e é vista aqui, ou espera.
      await this.organizations.lock(organizationId);
      const { role: actorRole } = await this.access.requirePermission(
        organizationId,
        actorId,
        OrganizationPermission.MEMBERS_INVITE,
      );

      // Quem convida precisa ter tudo o que o papel do convite concede: só
      // um OWNER traz outro OWNER.
      const role = await this.resolveRole(organizationId, input);
      ensureCanInviteWithRole(actorRole, role);

      const email = Email.create(input.email).value;
      await this.ensureNotMember(organizationId, email);

      const now = this.clock.now();
      return this.invitations.savePending(
        Invitation.create(
          { organizationId, email, roleId: role.id, invitedByUserId: actorId },
          now,
        ),
        {
          maxPendingPerOrganization: MAX_PENDING_INVITATIONS_PER_ORGANIZATION,
          now,
        },
      );
    });

    const [result] = await describeInvitations(this.users, this.roles, [
      invitation,
    ]);
    return result;
  }

  private async resolveRole(
    organizationId: string,
    { role, roleId }: InviteMemberInput,
  ): Promise<Role> {
    const hasRole = role !== undefined && role !== null;

    if (roleId !== undefined && roleId !== null) {
      if (hasRole) throw new InvalidInvitationError(ROLE_OR_ROLE_ID);
      return requireRole(this.roles, organizationId, roleId);
    }

    if (!hasRole) throw new InvalidInvitationError(ROLE_OR_ROLE_ID);
    const systemRole = await this.roles.findSystemRole(organizationId, role);
    if (!systemRole) throw new Error('Organização sem o papel de sistema.');
    return systemRole;
  }

  /** O e-mail não é único: basta um dos perfis com ele ser membro ativo. */
  private async ensureNotMember(
    organizationId: string,
    email: string,
  ): Promise<void> {
    const userIds = await this.users.getUserIdsByEmail(email);
    const memberships = await Promise.all(
      userIds.map((userId) =>
        this.memberships.findByOrganizationAndUser(organizationId, userId),
      ),
    );

    if (memberships.some((membership) => membership?.isActive())) {
      throw new AlreadyMemberError();
    }
  }
}
