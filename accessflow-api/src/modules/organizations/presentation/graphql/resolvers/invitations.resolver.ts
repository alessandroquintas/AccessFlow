import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthenticatedIdentity } from '@/modules/identity/application/ports/token-verifier.port';
import { JwtAuthGuard } from '@/modules/identity/presentation/auth/guards/jwt-auth.guard';
import { CurrentIdentity } from '@/modules/identity/presentation/auth/decorators/current-identity.decorator';
import { InviteMemberUseCase } from '@/modules/organizations/application/use-cases/invite-member.use-case';
import { ListOrganizationInvitationsUseCase } from '@/modules/organizations/application/use-cases/list-organization-invitations.use-case';
import { RevokeInvitationUseCase } from '@/modules/organizations/application/use-cases/revoke-invitation.use-case';
import { ListMyInvitationsUseCase } from '@/modules/organizations/application/use-cases/list-my-invitations.use-case';
import { AcceptInvitationUseCase } from '@/modules/organizations/application/use-cases/accept-invitation.use-case';
import { DeclineInvitationUseCase } from '@/modules/organizations/application/use-cases/decline-invitation.use-case';
import { ClockPort } from '@/shared/application/ports/clock.port';
import { decodeCursor } from '@/shared/presentation/graphql/pagination/cursor';
import { clampPageSize } from '@/shared/presentation/graphql/pagination/page-size';
import { InviteMemberInput } from '../inputs/invite-member.input';
import { systemKeyOf } from '../../membership-role';
import { OrganizationInvitationType } from '../types/organization-invitation.type';
import { OrganizationInvitationConnectionType } from '../types/organization-invitation-connection.type';
import { MyInvitationType } from '../types/my-invitation.type';
import { OrganizationType } from '../types/organization.type';

@Resolver(() => OrganizationInvitationType)
@UseGuards(JwtAuthGuard)
export class InvitationsResolver {
  constructor(
    private readonly inviteMemberUseCase: InviteMemberUseCase,
    private readonly listOrganizationInvitationsUseCase: ListOrganizationInvitationsUseCase,
    private readonly revokeInvitationUseCase: RevokeInvitationUseCase,
    private readonly listMyInvitationsUseCase: ListMyInvitationsUseCase,
    private readonly acceptInvitationUseCase: AcceptInvitationUseCase,
    private readonly declineInvitationUseCase: DeclineInvitationUseCase,
    // O status EXPIRED é calculado aqui, com o mesmo relógio dos casos de uso.
    private readonly clock: ClockPort,
  ) {}

  @Mutation(() => OrganizationInvitationType, {
    description:
      'Convida um e-mail para a organização. Convidar de novo o mesmo e-mail renova o convite pendente. Exige members:invite.',
  })
  async inviteMember(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('input') input: InviteMemberInput,
  ): Promise<OrganizationInvitationType> {
    const result = await this.inviteMemberUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      email: input.email,
      role: systemKeyOf(input.role),
    });

    return OrganizationInvitationType.from(result, this.clock.now());
  }

  @Query(() => OrganizationInvitationConnectionType, {
    description:
      'Convites pendentes da organização, expirados incluídos, do mais recente para o mais antigo. Exige members:invite.',
  })
  async organizationInvitations(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('first', { type: () => Int, nullable: true }) first?: number | null,
    @Args('after', { type: () => String, nullable: true })
    after?: string | null,
  ): Promise<OrganizationInvitationConnectionType> {
    const page = await this.listOrganizationInvitationsUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      first: clampPageSize(first),
      // Decodificado antes da checagem de acesso, como em organizationMembers:
      // INVALID_CURSOR não depende da organização.
      after: typeof after === 'string' ? decodeCursor(after) : undefined,
    });

    return OrganizationInvitationConnectionType.from(page, this.clock.now());
  }

  @Mutation(() => Boolean, {
    description:
      'Revoga um convite pendente, mesmo expirado. Exige members:invite.',
  })
  async revokeInvitation(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('invitationId', { type: () => ID }) invitationId: string,
  ): Promise<boolean> {
    await this.revokeInvitationUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      invitationId,
    });

    return true;
  }

  @Query(() => [MyInvitationType], {
    description:
      'Convites pendentes e no prazo para o e-mail do usuário autenticado.',
  })
  async myInvitations(
    @CurrentIdentity() identity: AuthenticatedIdentity,
  ): Promise<MyInvitationType[]> {
    const invitations = await this.listMyInvitationsUseCase.execute({
      cognitoSub: identity.sub,
    });

    return invitations.map(MyInvitationType.from);
  }

  @Mutation(() => OrganizationType, {
    description:
      'Aceita um convite para o e-mail do usuário autenticado e devolve a organização.',
  })
  async acceptInvitation(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('invitationId', { type: () => ID }) invitationId: string,
  ): Promise<OrganizationType> {
    const result = await this.acceptInvitationUseCase.execute({
      cognitoSub: identity.sub,
      invitationId,
    });

    return OrganizationType.from(result);
  }

  @Mutation(() => Boolean, {
    description: 'Recusa um convite para o e-mail do usuário autenticado.',
  })
  async declineInvitation(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('invitationId', { type: () => ID }) invitationId: string,
  ): Promise<boolean> {
    await this.declineInvitationUseCase.execute({
      cognitoSub: identity.sub,
      invitationId,
    });

    return true;
  }
}
