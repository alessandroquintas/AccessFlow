import { DomainError } from '@/shared/domain/errors/domain.error';

/** Corpo HTTP com Content-Type JSON que não é um JSON válido. */
export class InvalidJsonError extends DomainError {
  readonly code = 'INVALID_JSON';

  constructor() {
    super('O corpo da requisição não é um JSON válido.');
  }
}
