import { ClockPort } from '@/shared/application/ports/clock.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import {
  AuditAction,
  AuditEvent,
  userActor,
} from '../../domain/entities/audit-event.entity';
import { AuditLog } from '../../domain/repositories/audit-log.repository';
import { InvitationRepository } from '../../domain/repositories/invitation.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { requireOwnPendingInvitation } from '../services/require-own-pending-invitation';

export interface DeclineInvitationInput {
  cognitoSub: string;
  invitationId: string;
}

export class DeclineInvitationUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly organizations: OrganizationRepository,
    private readonly users: UserDirectoryPort,
    private readonly audit: AuditLog,
    private readonly transactions: TransactionManager,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: DeclineInvitationInput): Promise<void> {
    const user = await this.users.getActiveUser(input.cognitoSub);
    const now = this.clock.now();

    // Filtra antes de travar, como o aceite: id malformado, convite
    // inexistente, de outro e-mail, expirado ou já respondido respondem
    // NOT_FOUND sem tocar na organização. Daqui só sai qual organização travar.
    const { organizationId } = await requireOwnPendingInvitation(
      this.invitations,
      user,
      input.invitationId,
      now,
    );

    await this.transactions.run(async () => {
      // Ordem de trava de toda escrita: organização → convite. O evento
      // também toma a organização (pela FK de audit_events): sem a trava
      // aqui, o decline seguraria o convite antes dela.
      await this.organizations.lock(organizationId);
      const invitation = await requireOwnPendingInvitation(
        this.invitations,
        user,
        input.invitationId,
        now,
      );

      invitation.decline(now);
      await this.invitations.respond(invitation);
      // O ator é o convidado, que ainda não é membro.
      await this.audit.record(
        AuditEvent.create(
          {
            organizationId,
            actor: userActor(user.id),
            action: AuditAction.INVITATION_DECLINED,
            targetId: invitation.id,
            details: {},
          },
          now,
        ),
      );
    });
  }
}
