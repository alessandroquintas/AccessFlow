import { DomainError } from '@/shared/domain/errors/domain.error';

export class OrganizationPermissionDeniedError extends DomainError {
  readonly code = 'ORGANIZATION_PERMISSION_DENIED';

  constructor() {
    super('Você não tem permissão para esta ação nesta organização.');
  }
}
