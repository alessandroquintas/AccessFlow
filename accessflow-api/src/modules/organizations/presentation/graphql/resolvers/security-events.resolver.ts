import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import type { AuthenticatedIdentity } from '@/modules/identity/application/ports/token-verifier.port';
import { JwtAuthGuard } from '@/modules/identity/presentation/auth/guards/jwt-auth.guard';
import { CurrentIdentity } from '@/modules/identity/presentation/auth/decorators/current-identity.decorator';
import { ListSecurityEventsUseCase } from '@/modules/organizations/application/use-cases/list-security-events.use-case';
import { decodeCursor } from '@/shared/presentation/graphql/pagination/cursor';
import { clampPageSize } from '@/shared/presentation/graphql/pagination/page-size';
import { SecurityEventFilterInput } from '../inputs/security-event-filter.input';
import { SecurityEventGqlType } from '../types/security-event.type';
import { SecurityEventConnectionType } from '../types/security-event-connection.type';

@Resolver(() => SecurityEventGqlType)
@UseGuards(JwtAuthGuard)
export class SecurityEventsResolver {
  constructor(
    private readonly listSecurityEventsUseCase: ListSecurityEventsUseCase,
  ) {}

  @Query(() => SecurityEventConnectionType, {
    description:
      'Tentativas de acesso negadas na organização, da mais recente para a mais antiga: membros sem permissão e integrações dela sem escopo ou fora do vínculo. Exige audit:read.',
  })
  async securityEvents(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('first', { type: () => Int, nullable: true }) first?: number | null,
    @Args('after', { type: () => String, nullable: true })
    after?: string | null,
    @Args('filter', { type: () => SecurityEventFilterInput, nullable: true })
    filter?: SecurityEventFilterInput | null,
  ): Promise<SecurityEventConnectionType> {
    // Decodificado antes da checagem de acesso, como nas outras listagens.
    const cursor = typeof after === 'string' ? decodeCursor(after) : undefined;

    const page = await this.listSecurityEventsUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      first: clampPageSize(first),
      after: cursor && { occurredAt: cursor.createdAt, id: cursor.id },
      filter: filter
        ? {
            events: filter.events ?? undefined,
            actorUserId: filter.actorUserId ?? undefined,
            actorClientId: filter.actorClientId ?? undefined,
            occurredFrom: filter.occurredFrom ?? undefined,
            occurredTo: filter.occurredTo ?? undefined,
          }
        : undefined,
    });

    return SecurityEventConnectionType.from(page);
  }
}
