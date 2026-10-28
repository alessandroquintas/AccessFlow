import { DomainError } from '@/shared/domain/errors/domain.error';

/** Filtro da trilha de auditoria fora do formato: 400. */
export class InvalidAuditFilterError extends DomainError {
  readonly code = 'INVALID_AUDIT_FILTER';
}
