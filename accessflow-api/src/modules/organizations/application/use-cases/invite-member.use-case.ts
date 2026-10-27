import { ClockPort } from '@/shared/application/ports/clock.port';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { Invitation } from '../../domain/entities/invitation.entity';
import { MembershipRole } from '../../domain/entities/membership.entity';
import { AlreadyMemberError } from '../../domain/errors/already-member.error';
import { OrganizationPermissionDeniedError } from '../../domain/errors/organization-permission-denied.error';
import { InvitationRepository } from '../../domain/repositories/invitation.repository';
import { MembershipRepository } from '../../domain/repositories/membership.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { OrganizationInvitation } from '../dto/organization-invitation';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { attachInviters } from '../services/attach-inviters';
import { OrganizationAccessService } from '../services/organization-access.service';

/** Proteção contra abuso; convites expirados não ocupam vaga. */
export const MAX_PENDING_INVITATIONS_PER_ORGANIZATION = 50;

export interface InviteMemberInput {
  cognitoSub: string;
  organizationId: string;
  email: string;
  role: MembershipRole;
}

export class InviteMemberUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly memberships: MembershipRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
    private readonly clock: ClockPort,
  ) {}

  /** Cria o convite ou renova o pendente para o mesmo e-mail. */
  async execute(input: InviteMemberInput): Promise<OrganizationInvitation> {
    const actorId = await this.users.getActiveUserId(input.cognitoSub);
    const organizationId = input.organizationId.toLowerCase();

    const { membership: actor } = await this.access.requirePermission(
      organizationId,
      actorId,
      OrganizationPermission.MEMBERS_INVITE,
    );

    // Só um OWNER pode trazer outro OWNER.
    if (input.role === MembershipRole.OWNER && !actor.isOwner()) {
      throw new OrganizationPermissionDeniedError();
    }

    const email = Email.create(input.email).value;
    await this.ensureNotMember(organizationId, email);

    const now = this.clock.now();
    const invitation = await this.invitations.savePending(
      Invitation.create(
        { organizationId, email, role: input.role, invitedByUserId: actorId },
        now,
      ),
      {
        maxPendingPerOrganization: MAX_PENDING_INVITATIONS_PER_ORGANIZATION,
        now,
      },
    );

    const [result] = await attachInviters(this.users, [invitation]);
    return result;
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
