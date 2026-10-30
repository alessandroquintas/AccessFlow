import { DomainError } from '@/shared/domain/errors/domain.error';

/** Codificação (Content-Encoding) ou charset do corpo que o body-parser não lê. */
export class UnsupportedMediaTypeError extends DomainError {
  readonly code = 'UNSUPPORTED_MEDIA_TYPE';

  constructor() {
    super('A codificação ou o charset do corpo da requisição não é suportado.');
  }
}
