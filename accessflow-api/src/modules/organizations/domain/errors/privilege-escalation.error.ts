import { DomainError } from '@/shared/domain/errors/domain.error';

export class PrivilegeEscalationError extends DomainError {
  readonly code = 'PRIVILEGE_ESCALATION';

  constructor() {
    super(
      'Você não pode conceder, retirar ou atribuir permissões que não tem.',
    );
  }
}
