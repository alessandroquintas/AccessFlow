import { DomainError } from '@/shared/domain/errors/domain.error';

export class InvalidOrganizationError extends DomainError {
  readonly code = 'INVALID_ORGANIZATION';
}
