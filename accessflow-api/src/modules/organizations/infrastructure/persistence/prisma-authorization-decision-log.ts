import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type AuthorizationDecision as PrismaAuthorizationDecision,
} from '@prisma/client';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { RequestContextPort } from '@/shared/application/ports/request-context.port';
import { AuthorizationDecision } from '@/modules/organizations/domain/entities/authorization-decision.entity';
import {
  AuthorizationDecisionCursor,
  AuthorizationDecisionFilter,
  AuthorizationDecisionLog,
  AuthorizationDecisionPage,
} from '@/modules/organizations/domain/repositories/authorization-decision-log.repository';
import { PrismaAuthorizationDecisionMapper } from './mappers/prisma-authorization-decision.mapper';

@Injectable()
export class PrismaAuthorizationDecisionLog extends AuthorizationDecisionLog {
  constructor(
    private readonly clients: PrismaClientProvider,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  async record(decision: AuthorizationDecision): Promise<void> {
    // Um INSERT só. O authorize não abre transação: vai pelo cliente raiz.
    await this.clients.current().authorizationDecision.create({
      data: {
        ...PrismaAuthorizationDecisionMapper.toPersistence(decision),
        requestId: this.requestContext.requestId() ?? null,
      },
    });
  }

  async listByOrganization(
    organizationId: string,
    {
      first,
      after,
      filter = {},
    }: {
      first: number;
      after?: AuthorizationDecisionCursor;
      filter?: AuthorizationDecisionFilter;
    },
  ): Promise<AuthorizationDecisionPage> {
    const conditions = [
      Prisma.sql`organization_id = ${organizationId}::uuid`,
      ...filterConditions(filter),
    ];
    if (after) {
      // Comparação de linha, como na trilha: o cursor entra no Index Cond.
      conditions.push(
        Prisma.sql`(decided_at, id) < (${after.decidedAt}::timestamptz, ${after.id}::uuid)`,
      );
    }

    // Um item a mais indica se existe próxima página, sem precisar de count.
    const records = await this.clients.current().$queryRaw<
      PrismaAuthorizationDecision[]
    >`
      SELECT id,
             organization_id AS "organizationId",
             client_id AS "clientId",
             subject_user_id AS "subjectUserId",
             results,
             allowed,
             request_id AS "requestId",
             decided_at AS "decidedAt"
      FROM authorization_decisions
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY decided_at DESC, id DESC
      LIMIT ${first + 1}`;

    return {
      items: records.slice(0, first).map((record) => ({
        decision: PrismaAuthorizationDecisionMapper.toDomain(record),
        requestId: record.requestId,
      })),
      hasNextPage: records.length > first,
    };
  }
}

/** Critérios do filtro, todos parametrizados; ausente não filtra. */
function filterConditions(filter: AuthorizationDecisionFilter): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  if (filter.subjectUserId) {
    conditions.push(
      Prisma.sql`subject_user_id = ${filter.subjectUserId}::uuid`,
    );
  }
  if (filter.clientId !== undefined) {
    conditions.push(Prisma.sql`client_id = ${filter.clientId}`);
  }
  if (filter.allowed !== undefined) {
    conditions.push(Prisma.sql`allowed = ${filter.allowed}`);
  }
  if (filter.permission) {
    // Alguma das chaves pedidas, permitida ou não.
    const wanted = JSON.stringify([{ permission: filter.permission }]);
    conditions.push(Prisma.sql`results @> ${wanted}::jsonb`);
  }
  if (filter.decidedFrom) {
    conditions.push(
      Prisma.sql`decided_at >= ${filter.decidedFrom}::timestamptz`,
    );
  }
  if (filter.decidedTo) {
    conditions.push(Prisma.sql`decided_at <= ${filter.decidedTo}::timestamptz`);
  }
  return conditions;
}
