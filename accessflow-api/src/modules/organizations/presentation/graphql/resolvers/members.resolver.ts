import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthenticatedIdentity } from '@/modules/identity/application/ports/token-verifier.port';
import { JwtAuthGuard } from '@/modules/identity/presentation/graphql/guards/jwt-auth.guard';
import { CurrentIdentity } from '@/modules/identity/presentation/graphql/decorators/current-identity.decorator';
import { ListOrganizationMembersUseCase } from '@/modules/organizations/application/use-cases/list-organization-members.use-case';
import { RemoveMemberUseCase } from '@/modules/organizations/application/use-cases/remove-member.use-case';
import { LeaveOrganizationUseCase } from '@/modules/organizations/application/use-cases/leave-organization.use-case';
import { decodeCursor } from '@/shared/presentation/graphql/pagination/cursor';
import { clampPageSize } from '@/shared/presentation/graphql/pagination/page-size';
import { OrganizationMemberType } from '../types/organization-member.type';
import { OrganizationMemberConnectionType } from '../types/organization-member-connection.type';

@Resolver(() => OrganizationMemberType)
@UseGuards(JwtAuthGuard)
export class MembersResolver {
  constructor(
    private readonly listOrganizationMembersUseCase: ListOrganizationMembersUseCase,
    private readonly removeMemberUseCase: RemoveMemberUseCase,
    private readonly leaveOrganizationUseCase: LeaveOrganizationUseCase,
  ) {}

  @Query(() => OrganizationMemberConnectionType, {
    description:
      'Membros ativos da organização, do mais antigo para o mais recente.',
  })
  async organizationMembers(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('first', { type: () => Int, nullable: true }) first?: number | null,
    @Args('after', { type: () => String, nullable: true })
    after?: string | null,
  ): Promise<OrganizationMemberConnectionType> {
    const page = await this.listOrganizationMembersUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      first: clampPageSize(first),
      // Decodificado antes da checagem de acesso de propósito: INVALID_CURSOR
      // não depende da organização e é igual para qualquer organizationId,
      // então não revela se ela existe.
      after: typeof after === 'string' ? decodeCursor(after) : undefined,
    });

    return OrganizationMemberConnectionType.from(page);
  }

  @Mutation(() => Boolean, {
    description: 'Remove um membro da organização. Exige ser OWNER.',
  })
  async removeMember(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('userId', { type: () => ID }) userId: string,
  ): Promise<boolean> {
    await this.removeMemberUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      userId,
    });

    return true;
  }

  @Mutation(() => Boolean, {
    description: 'O usuário autenticado sai da organização.',
  })
  async leaveOrganization(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
  ): Promise<boolean> {
    await this.leaveOrganizationUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
    });

    return true;
  }
}
