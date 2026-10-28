import { DomainError } from '@/shared/domain/errors/domain.error';

export class PermissionLimitReachedError extends DomainError {
  readonly code = 'PERMISSION_LIMIT_REACHED';

  constructor() {
    super('A organização atingiu o limite de permissões personalizadas.');
  }
}
