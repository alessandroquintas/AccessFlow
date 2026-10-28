import { DomainError } from '@/shared/domain/errors/domain.error';
import { SecurityEventType } from '@/shared/domain/security-denial';

export class InsufficientScopeError extends DomainError {
  readonly code = 'INSUFFICIENT_SCOPE';

  /** Com o client que pediu, a negação vira machine.scope_denied. */
  constructor(denied?: {
    clientId: string;
    requiredScopes: readonly string[];
  }) {
    super(
      'O token não tem permissão para esta operação.',
      denied && {
        event: SecurityEventType.MACHINE_SCOPE_DENIED,
        clientId: denied.clientId,
        requiredScopes: [...denied.requiredScopes],
      },
    );
  }
}
