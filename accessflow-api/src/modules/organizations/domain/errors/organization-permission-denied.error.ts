import { DomainError } from '@/shared/domain/errors/domain.error';
import { SecurityEventType } from '@/shared/domain/security-denial';

export class OrganizationPermissionDeniedError extends DomainError {
  readonly code = 'ORGANIZATION_PERMISSION_DENIED';

  /** Com a organização e a permissão, a negação vira access.forbidden. */
  constructor(denied?: { organizationId: string; permission: string }) {
    super(
      'Você não tem permissão para esta ação nesta organização.',
      denied && { event: SecurityEventType.ACCESS_FORBIDDEN, ...denied },
    );
  }
}
