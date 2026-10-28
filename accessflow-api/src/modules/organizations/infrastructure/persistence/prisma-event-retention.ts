import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import {
  EventRetention,
  RetentionDays,
} from '@/modules/organizations/domain/repositories/event-retention.repository';

/**
 * Cada lote é uma instrução, e portanto uma transação curta: o now() e o
 * prazo que escolhem as linhas são os mesmos que o trigger confere em cada
 * DELETE. Pelo cliente raiz: o expurgo não roda dentro de outra transação.
 */
@Injectable()
export class PrismaEventRetention extends EventRetention {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async retentionDays(): Promise<RetentionDays> {
    const [days] = await this.prisma.$queryRaw<RetentionDays[]>`
      SELECT extract(day FROM authorization_decisions_retention())::int AS "authorizationDecisions",
             extract(day FROM security_events_retention())::int AS "securityEvents"`;
    return days;
  }

  // A lista de ids sai do índice de tempo, só com as vencidas, e o DELETE as
  // acha pela chave primária. Com `id IN (subconsulta)`, o planejador pode
  // juntar com uma leitura da tabela inteira a cada lote.
  deleteExpiredAuthorizationDecisions(limit: number): Promise<number> {
    return this.prisma.$executeRaw`
      DELETE FROM authorization_decisions
      WHERE id = ANY(ARRAY(
        SELECT id FROM authorization_decisions
        WHERE decided_at < now() - authorization_decisions_retention()
        ORDER BY decided_at
        LIMIT ${limit}))`;
  }

  deleteExpiredSecurityEvents(limit: number): Promise<number> {
    return this.prisma.$executeRaw`
      DELETE FROM security_events
      WHERE id = ANY(ARRAY(
        SELECT id FROM security_events
        WHERE occurred_at < now() - security_events_retention()
        ORDER BY occurred_at
        LIMIT ${limit}))`;
  }
}
