import { InvalidEmailError } from '../errors/invalid-email.error';

export class Email {
  private static readonly PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly MAX_LENGTH = 254;

  private constructor(readonly value: string) {}

  /** Normaliza para minúsculas e sem espaços nas pontas. */
  static create(raw: string): Email {
    const value = raw?.trim().toLowerCase() ?? '';

    if (value.length > Email.MAX_LENGTH || !Email.PATTERN.test(value)) {
      throw new InvalidEmailError();
    }

    return new Email(value);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
