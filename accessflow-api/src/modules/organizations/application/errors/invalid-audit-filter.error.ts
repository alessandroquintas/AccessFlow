import { DomainError } from '@/shared/domain/errors/domain.error';

/**
 * Filtro das leituras de auditoria (trilha, decisões e eventos de
 * segurança) fora do formato: 400.
 */
export class InvalidAuditFilterError extends DomainError {
  readonly code = 'INVALID_AUDIT_FILTER';
}
