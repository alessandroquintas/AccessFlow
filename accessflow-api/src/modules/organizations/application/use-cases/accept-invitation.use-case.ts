import { ClockPort } from '@/shared/application/ports/clock.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { InvitationNotFoundError } from '../../domain/errors/invitation-not-found.error';
import { InvitationRepository } from '../../domain/repositories/invitation.repository';
import { MembershipRepository } from '../../domain/repositories/membership.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { OrganizationWithMembership } from '../dto/organization-with-membership';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { requireOwnPendingInvitation } from '../services/require-own-pending-invitation';
import {
  AuditAction,
  AuditEvent,
  userActor,
} from '../../domain/entities/audit-event.entity';
import { AuditLog } from '../../domain/repositories/audit-log.repository';

export interface AcceptInvitationInput {
  cognitoSub: string;
  invitationId: string;
}

export class AcceptInvitationUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly organizations: OrganizationRepository,
    private readonly roles: RoleRepository,
    private readonly memberships: MembershipRepository,
    private readonly users: UserDirectoryPort,
    private readonly audit: AuditLog,
    private readonly transactions: TransactionManager,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    input: AcceptInvitationInput,
  ): Promise<OrganizationWithMembership> {
    const user = await this.users.getActiveUser(input.cognitoSub);
    const now = this.clock.now();

    // Filtra antes de travar: id malformado, convite inexistente, de outro
    // e-mail, expirado ou já respondido respondem NOT_FOUND sem tocar na
    // organização. Daqui só sai qual organização travar.
    const { organizationId } = await requireOwnPendingInvitation(
      this.invitations,
      user,
      input.invitationId,
      now,
    );

    return this.transactions.run(async () => {
      // Ordem de trava de toda escrita: organização → convite → membership.
      // A releitura com a organização travada revalida status, e-mail e
      // prazo, e traz o papel atual (um reconvite pode tê-lo trocado).
      await this.organizations.lock(organizationId);
      const invitation = await requireOwnPendingInvitation(
        this.invitations,
        user,
        input.invitationId,
        now,
      );

      const organization = await this.organizations.findById(organizationId);
      if (!organization?.isActive()) throw new InvitationNotFoundError();

      // O desfecho, lido com a organização travada (remoção e saída também a
      // travam): é o mesmo que o repositório vai encontrar logo abaixo.
      const existing = await this.memberships.findByOrganizationAndUser(
        organizationId,
        user.id,
      );
      const outcome = !existing
        ? 'created'
        : existing.isActive()
          ? 'unchanged'
          : 'reactivated';

      // Manter, reativar ou criar o membership é decidido dentro da transação
      // do repositório, com o estado do banco já travado.
      invitation.accept(now);
      const membership = await this.invitations.accept(invitation, {
        userId: user.id,
        now,
      });

      // O do convite, ou o que já tinha se já era membro ativo.
      const role = await this.roles.findById(
        organization.id,
        membership.roleId,
      );
      if (!role) throw new Error('Membership sem papel ativo na organização.');

      // O ator é o convidado; roleId é o papel depois do aceite.
      await this.audit.record(
        AuditEvent.create(
          {
            organizationId,
            actor: userActor(user.id),
            action: AuditAction.INVITATION_ACCEPTED,
            targetId: invitation.id,
            details: {
              roleId: membership.roleId,
              memberUserId: user.id,
              membership: outcome,
            },
          },
          now,
        ),
      );

      return { organization, membership, role };
    });
  }
}
