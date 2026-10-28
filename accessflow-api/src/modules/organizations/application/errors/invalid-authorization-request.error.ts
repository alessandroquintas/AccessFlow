import { DomainError } from '@/shared/domain/errors/domain.error';

/** Pedido de autorização fora do formato: 400, antes de olhar a organização. */
export class InvalidAuthorizationRequestError extends DomainError {
  readonly code = 'INVALID_AUTHORIZATION_REQUEST';
}
