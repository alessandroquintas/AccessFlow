import { ClockPort } from '@/shared/application/ports/clock.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { isUuid } from '@/shared/domain/uuid';
import { InvitationNotFoundError } from '../../domain/errors/invitation-not-found.error';
import { InvitationRepository } from '../../domain/repositories/invitation.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';
import {
  AuditAction,
  AuditEvent,
  userActor,
} from '../../domain/entities/audit-event.entity';
import { AuditLog } from '../../domain/repositories/audit-log.repository';

export interface RevokeInvitationInput {
  cognitoSub: string;
  organizationId: string;
  invitationId: string;
}

export class RevokeInvitationUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly invitations: InvitationRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
    private readonly audit: AuditLog,
    private readonly transactions: TransactionManager,
    private readonly clock: ClockPort,
  ) {}

  /** Vale também para convites expirados, que continuam PENDING. */
  async execute(input: RevokeInvitationInput): Promise<void> {
    const actorId = await this.users.getActiveUserId(input.cognitoSub);
    const organizationId = input.organizationId.toLowerCase();

    await this.transactions.run(async () => {
      // Trava antes de checar, como nas demais escritas que dependem de
      // permissão.
      await this.organizations.lock(organizationId);
      await this.access.requirePermission(
        organizationId,
        actorId,
        OrganizationPermission.MEMBERS_INVITE,
      );

      const invitationId = input.invitationId.toLowerCase();
      if (!isUuid(invitationId)) throw new InvitationNotFoundError();

      // Convite de outra organização responde como inexistente.
      const invitation = await this.invitations.findById(invitationId);
      if (invitation?.organizationId !== organizationId) {
        throw new InvitationNotFoundError();
      }

      const now = this.clock.now();
      invitation.revoke(now);
      await this.invitations.respond(invitation);
      await this.audit.record(
        AuditEvent.create(
          {
            organizationId,
            actor: userActor(actorId),
            action: AuditAction.INVITATION_REVOKED,
            targetId: invitation.id,
            details: {},
          },
          now,
        ),
      );
    });
  }
}
