import { DomainError } from '@/shared/domain/errors/domain.error';
import { SecurityEventType } from '@/shared/domain/security-denial';

export class PrivilegeEscalationError extends DomainError {
  readonly code = 'PRIVILEGE_ESCALATION';

  /** Com a organização, a negação vira access.privilege_escalation. */
  constructor(organizationId?: string) {
    super(
      'Você não pode conceder, retirar ou atribuir permissões que não tem.',
      organizationId === undefined
        ? undefined
        : {
            event: SecurityEventType.ACCESS_PRIVILEGE_ESCALATION,
            organizationId,
          },
    );
  }
}
