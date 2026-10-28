import type { SecurityDenial } from '../security-denial';

export abstract class DomainError extends Error {
  abstract readonly code: string;
  /** Preenchido quando o erro é uma negação que vira evento de segurança. */
  readonly securityDenial?: SecurityDenial;

  constructor(message: string, securityDenial?: SecurityDenial) {
    super(message);
    this.name = new.target.name;
    this.securityDenial = securityDenial;
  }
}
