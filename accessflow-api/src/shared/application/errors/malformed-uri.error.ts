import { DomainError } from '@/shared/domain/errors/domain.error';

/** Caminho com codificação percentual inválida (ex.: `%E0%A4%A`). */
export class MalformedUriError extends DomainError {
  readonly code = 'MALFORMED_URI';

  constructor() {
    super('O endereço da requisição está malformado.');
  }
}
