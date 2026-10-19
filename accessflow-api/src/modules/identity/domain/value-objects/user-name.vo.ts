import { InvalidUserError } from '../errors/invalid-user.error';

export class UserName {
  static readonly MIN_LENGTH = 2;
  static readonly MAX_LENGTH = 100;

  private constructor(readonly value: string) {}

  static create(raw: string): UserName {
    const value = raw.trim() ?? '';

    if (
      value.length < UserName.MIN_LENGTH ||
      value.length > UserName.MAX_LENGTH
    ) {
      throw new InvalidUserError(
        `name deve ter entre ${UserName.MIN_LENGTH} e ${UserName.MAX_LENGTH} caracteres.`,
      );
    }

    return new UserName(value);
  }
}
