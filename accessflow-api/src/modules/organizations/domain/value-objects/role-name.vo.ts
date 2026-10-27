import { InvalidRoleError } from '../errors/invalid-role.error';

/**
 * Nome de papel: em NFC, sem espaços nas pontas e com os internos
 * colapsados. A unicidade na organização não diferencia maiúsculas e
 * minúsculas: compare pela `key`.
 */
export class RoleName {
  static readonly MAX_LENGTH = 50;

  private constructor(readonly value: string) {}

  static create(raw: string): RoleName {
    // NFC primeiro: "ê" composto e "e" + acento combinante viram o mesmo
    // texto, e o acento solto não conta como caractere a mais.
    const value = (raw ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
    // Conta caracteres, não unidades UTF-16: um emoji vale um.
    const length = [...value].length;

    if (length < 1 || length > RoleName.MAX_LENGTH) {
      throw new InvalidRoleError(
        `Name deve ter entre 1 e ${RoleName.MAX_LENGTH} caracteres.`,
      );
    }

    return new RoleName(value);
  }

  /** Forma usada para comparar nomes. */
  get key(): string {
    return this.value.toLowerCase();
  }

  sameAs(other: RoleName): boolean {
    return this.key === other.key;
  }
}
