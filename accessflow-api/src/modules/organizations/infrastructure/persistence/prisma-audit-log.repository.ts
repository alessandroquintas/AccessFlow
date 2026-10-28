import { Injectable } from '@nestjs/common';
import { Prisma, type AuditEvent as PrismaAuditEvent } from '@prisma/client';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { RequestContextPort } from '@/shared/application/ports/request-context.port';
import { AuditEvent } from '@/modules/organizations/domain/entities/audit-event.entity';
import {
  AuditEventCursor,
  AuditEventFilter,
  AuditEventPage,
  AuditLog,
} from '@/modules/organizations/domain/repositories/audit-log.repository';
import { PrismaAuditEventMapper } from './mappers/prisma-audit-event.mapper';

@Injectable()
export class PrismaAuditLogRepository extends AuditLog {
  constructor(
    private readonly clients: PrismaClientProvider,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  async record(event: AuditEvent): Promise<void> {
    // Na transação ativa, se houver: o evento e a ação vão juntos.
    await this.clients.current().auditEvent.create({
      data: {
        ...PrismaAuditEventMapper.toPersistence(event),
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
    }: { first: number; after?: AuditEventCursor; filter?: AuditEventFilter },
  ): Promise<AuditEventPage> {
    const conditions = [
      Prisma.sql`organization_id = ${organizationId}::uuid`,
      ...filterConditions(filter),
    ];
    if (after) {
      // Comparação de linha, e não o OR das outras listagens: assim o cursor
      // entra no Index Cond do índice (organization_id, occurred_at DESC,
      // id DESC) e a página não relê o que veio antes. A trilha só cresce.
      conditions.push(
        Prisma.sql`(occurred_at, id) < (${after.occurredAt}::timestamptz, ${after.id}::uuid)`,
      );
    }

    // Um item a mais indica se existe próxima página, sem precisar de count.
    const records = await this.clients.current().$queryRaw<PrismaAuditEvent[]>`
      SELECT id,
             organization_id AS "organizationId",
             actor_type AS "actorType",
             actor_user_id AS "actorUserId",
             actor_client_id AS "actorClientId",
             action,
             target_type AS "targetType",
             target_id AS "targetId",
             details,
             occurred_at AS "occurredAt",
             request_id AS "requestId"
      FROM audit_events
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY occurred_at DESC, id DESC
      LIMIT ${first + 1}`;

    return {
      items: records.slice(0, first).map((record) => ({
        event: PrismaAuditEventMapper.toDomain(record),
        requestId: record.requestId,
      })),
      hasNextPage: records.length > first,
    };
  }
}

/** Critérios do filtro, todos parametrizados; ausente não filtra. */
function filterConditions(filter: AuditEventFilter): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  if (filter.actions?.length) {
    conditions.push(Prisma.sql`action IN (${Prisma.join(filter.actions)})`);
  }
  if (filter.actorUserId) {
    conditions.push(Prisma.sql`actor_user_id = ${filter.actorUserId}::uuid`);
  }
  if (filter.targetType) {
    conditions.push(Prisma.sql`target_type = ${filter.targetType}`);
  }
  if (filter.targetId) {
    conditions.push(Prisma.sql`target_id = ${filter.targetId}`);
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
