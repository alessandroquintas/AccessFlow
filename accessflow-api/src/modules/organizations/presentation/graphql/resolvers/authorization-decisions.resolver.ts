import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import type { AuthenticatedIdentity } from '@/modules/identity/application/ports/token-verifier.port';
import { JwtAuthGuard } from '@/modules/identity/presentation/auth/guards/jwt-auth.guard';
import { CurrentIdentity } from '@/modules/identity/presentation/auth/decorators/current-identity.decorator';
import { ListAuthorizationDecisionsUseCase } from '@/modules/organizations/application/use-cases/list-authorization-decisions.use-case';
import { decodeCursor } from '@/shared/presentation/graphql/pagination/cursor';
import { clampPageSize } from '@/shared/presentation/graphql/pagination/page-size';
import { AuthorizationDecisionFilterInput } from '../inputs/authorization-decision-filter.input';
import { AuthorizationDecisionGqlType } from '../types/authorization-decision.type';
import { AuthorizationDecisionConnectionType } from '../types/authorization-decision-connection.type';

@Resolver(() => AuthorizationDecisionGqlType)
@UseGuards(JwtAuthGuard)
export class AuthorizationDecisionsResolver {
  constructor(
    private readonly listAuthorizationDecisionsUseCase: ListAuthorizationDecisionsUseCase,
  ) {}

  @Query(() => AuthorizationDecisionConnectionType, {
    description:
      'Respostas 200 do POST /v1/authorize na organização, da mais recente para a mais antiga. Exige audit:read.',
  })
  async authorizationDecisions(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('first', { type: () => Int, nullable: true }) first?: number | null,
    @Args('after', { type: () => String, nullable: true })
    after?: string | null,
    @Args('filter', {
      type: () => AuthorizationDecisionFilterInput,
      nullable: true,
    })
    filter?: AuthorizationDecisionFilterInput | null,
  ): Promise<AuthorizationDecisionConnectionType> {
    // Decodificado antes da checagem de acesso, como nas outras listagens.
    const cursor = typeof after === 'string' ? decodeCursor(after) : undefined;

    const page = await this.listAuthorizationDecisionsUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      first: clampPageSize(first),
      after: cursor && { decidedAt: cursor.createdAt, id: cursor.id },
      filter: filter
        ? {
            subjectUserId: filter.subjectUserId ?? undefined,
            clientId: filter.clientId ?? undefined,
            allowed: filter.allowed ?? undefined,
            permission: filter.permission ?? undefined,
            decidedFrom: filter.decidedFrom ?? undefined,
            decidedTo: filter.decidedTo ?? undefined,
          }
        : undefined,
    });

    return AuthorizationDecisionConnectionType.from(page);
  }
}
