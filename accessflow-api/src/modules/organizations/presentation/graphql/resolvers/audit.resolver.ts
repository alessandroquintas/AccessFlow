import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import type { AuthenticatedIdentity } from '@/modules/identity/application/ports/token-verifier.port';
import { JwtAuthGuard } from '@/modules/identity/presentation/auth/guards/jwt-auth.guard';
import { CurrentIdentity } from '@/modules/identity/presentation/auth/decorators/current-identity.decorator';
import { ListAuditEventsUseCase } from '@/modules/organizations/application/use-cases/list-audit-events.use-case';
import { decodeCursor } from '@/shared/presentation/graphql/pagination/cursor';
import { clampPageSize } from '@/shared/presentation/graphql/pagination/page-size';
import { AuditEventFilterInput } from '../inputs/audit-event-filter.input';
import { AuditEventGqlType } from '../types/audit-event.type';
import { AuditEventConnectionType } from '../types/audit-event-connection.type';

@Resolver(() => AuditEventGqlType)
@UseGuards(JwtAuthGuard)
export class AuditResolver {
  constructor(
    private readonly listAuditEventsUseCase: ListAuditEventsUseCase,
  ) {}

  @Query(() => AuditEventConnectionType, {
    description:
      'Trilha de auditoria da organização, do mais recente para o mais antigo. Exige audit:read.',
  })
  async auditEvents(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('first', { type: () => Int, nullable: true }) first?: number | null,
    @Args('after', { type: () => String, nullable: true })
    after?: string | null,
    @Args('filter', { type: () => AuditEventFilterInput, nullable: true })
    filter?: AuditEventFilterInput | null,
  ): Promise<AuditEventConnectionType> {
    // Decodificado antes da checagem de acesso, como nas outras listagens.
    const cursor = typeof after === 'string' ? decodeCursor(after) : undefined;

    const page = await this.listAuditEventsUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      first: clampPageSize(first),
      after: cursor && { occurredAt: cursor.createdAt, id: cursor.id },
      filter: filter
        ? {
            actions: filter.actions ?? undefined,
            actorUserId: filter.actorUserId ?? undefined,
            targetType: filter.targetType ?? undefined,
            targetId: filter.targetId ?? undefined,
            occurredFrom: filter.occurredFrom ?? undefined,
            occurredTo: filter.occurredTo ?? undefined,
          }
        : undefined,
    });

    return AuditEventConnectionType.from(page);
  }
}
