import { DomainError } from '@/shared/domain/errors/domain.error';

/** Corpo acima do limite do body-parser. */
export class PayloadTooLargeError extends DomainError {
  readonly code = 'PAYLOAD_TOO_LARGE';

  constructor() {
    super('O corpo da requisição excede o tamanho permitido.');
  }
}
