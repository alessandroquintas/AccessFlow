import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type SecurityEvent as PrismaSecurityEvent,
} from '@prisma/client';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { RequestContextPort } from '@/shared/application/ports/request-context.port';
import { SecurityEvent } from '@/modules/organizations/domain/entities/security-event.entity';
import {
  SecurityEventCursor,
  SecurityEventFilter,
  SecurityEventLog,
  SecurityEventPage,
} from '@/modules/organizations/domain/repositories/security-event-log.repository';
import { PrismaSecurityEventMapper } from './mappers/prisma-security-event.mapper';

/**
 * Sempre pelo cliente raiz, e não pelo PrismaClientProvider.current(): o
 * evento nunca entra na transação ativa, que a negação vai desfazer.
 */
@Injectable()
export class PrismaSecurityEventLog extends SecurityEventLog {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  async record(event: SecurityEvent): Promise<void> {
    await this.prisma.securityEvent.create({
      data: {
        ...PrismaSecurityEventMapper.toPersistence(event),
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
      after?: SecurityEventCursor;
      filter?: SecurityEventFilter;
    },
  ): Promise<SecurityEventPage> {
    const conditions = [
      Prisma.sql`organization_id = ${organizationId}::uuid`,
      ...filterConditions(filter),
    ];
    if (after) {
      // Comparação de linha, como no auditEvents: o cursor entra no Index
      // Cond de (organization_id, occurred_at DESC, id DESC).
      conditions.push(
        Prisma.sql`(occurred_at, id) < (${after.occurredAt}::timestamptz, ${after.id}::uuid)`,
      );
    }

    // Um item a mais indica se existe próxima página, sem precisar de count.
    const records = await this.prisma.$queryRaw<PrismaSecurityEvent[]>`
      SELECT id,
             organization_id AS "organizationId",
             actor_type AS "actorType",
             actor_user_id AS "actorUserId",
             actor_client_id AS "actorClientId",
             event,
             details,
             request_id AS "requestId",
             occurred_at AS "occurredAt"
      FROM security_events
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY occurred_at DESC, id DESC
      LIMIT ${first + 1}`;

    return {
      items: records.slice(0, first).map((record) => ({
        event: PrismaSecurityEventMapper.toDomain(record),
        requestId: record.requestId,
      })),
      hasNextPage: records.length > first,
    };
  }
}

/** Critérios do filtro, todos parametrizados; ausente não filtra. */
function filterConditions(filter: SecurityEventFilter): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  if (filter.events?.length) {
    conditions.push(Prisma.sql`event IN (${Prisma.join(filter.events)})`);
  }
  if (filter.actorUserId) {
    conditions.push(Prisma.sql`actor_user_id = ${filter.actorUserId}::uuid`);
  }
  if (filter.actorClientId) {
    conditions.push(Prisma.sql`actor_client_id = ${filter.actorClientId}`);
  }
  if (filter.occurredFrom) {
    conditions.push(
      Prisma.sql`occurred_at >= ${filter.occurredFrom}::timestamptz`,
    );
  }
  if (filter.occurredTo) {
    conditions.push(
      Prisma.sql`occurred_at <= ${filter.occurredTo}::timestamptz`,
    );
  }
  return conditions;
}
