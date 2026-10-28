import { DomainError } from '@/shared/domain/errors/domain.error';
import {
  SecurityDenial,
  SecurityEventType,
} from '@/shared/domain/security-denial';

export class OrganizationNotFoundError extends DomainError {
  readonly code = 'ORGANIZATION_NOT_FOUND';

  /**
   * A mesma resposta de organização inexistente para um client de
   * integração fora do seu vínculo, mas que vira
   * machine.organization_denied. O não membro, ao contrário, não vira
   * evento.
   */
  static outsideClientBinding(clientId: string): OrganizationNotFoundError {
    return new OrganizationNotFoundError({
      event: SecurityEventType.MACHINE_ORGANIZATION_DENIED,
      clientId,
    });
  }

  constructor(
    securityDenial?: Extract<
      SecurityDenial,
      { event: typeof SecurityEventType.MACHINE_ORGANIZATION_DENIED }
    >,
  ) {
    super('Organização não encontrada.', securityDenial);
  }
}
