import { DomainError } from '@/shared/domain/errors/domain.error';

export class OrganizationNotFoundError extends DomainError {
  readonly code = 'ORGANIZATION_NOT_FOUND';

  constructor() {
    super('Organização não encontrada.');
  }
}
