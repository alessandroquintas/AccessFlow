import {
  Prisma,
  type AuthorizationDecision as PrismaAuthorizationDecision,
} from '@prisma/client';
import { AuthorizationDecision } from '@/modules/organizations/domain/entities/authorization-decision.entity';
import { PermissionDecision } from '@/modules/organizations/policies/authorization';

export class PrismaAuthorizationDecisionMapper {
  /** O CHECK da tabela garante o formato do results e a coerência do allowed. */
  static toDomain(record: PrismaAuthorizationDecision): AuthorizationDecision {
    return AuthorizationDecision.restore({
      id: record.id,
      organizationId: record.organizationId,
      clientId: record.clientId,
      subjectUserId: record.subjectUserId,
      results: record.results as unknown as PermissionDecision[],
      decidedAt: record.decidedAt,
    });
  }

  static toPersistence(
    decision: AuthorizationDecision,
  ): Prisma.AuthorizationDecisionUncheckedCreateInput {
    return {
      id: decision.id,
      organizationId: decision.organizationId,
      clientId: decision.clientId,
      subjectUserId: decision.subjectUserId,
      results: decision.results.map(({ permission, allowed }) => ({
        permission,
        allowed,
      })),
      allowed: decision.allowed,
      decidedAt: decision.decidedAt,
    };
  }
}
