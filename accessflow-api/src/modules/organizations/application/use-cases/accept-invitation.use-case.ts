import { ClockPort } from '@/shared/application/ports/clock.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { InvitationNotFoundError } from '../../domain/errors/invitation-not-found.error';
import { InvitationRepository } from '../../domain/repositories/invitation.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { OrganizationWithMembership } from '../dto/organization-with-membership';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { requireOwnPendingInvitation } from '../services/require-own-pending-invitation';

export interface AcceptInvitationInput {
  cognitoSub: string;
  invitationId: string;
}

export class AcceptInvitationUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly organizations: OrganizationRepository,
    private readonly roles: RoleRepository,
    private readonly users: UserDirectoryPort,
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

      return { organization, membership, role };
    });
  }
}
