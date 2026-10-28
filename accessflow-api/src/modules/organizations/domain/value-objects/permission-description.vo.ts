import { InvalidPermissionDescriptionError } from '../errors/invalid-permission-description.error';

/** Descrição de permissão: em NFC, sem espaços nas pontas nem repetidos. */
export class PermissionDescription {
  static readonly MAX_LENGTH = 200;

  private constructor(readonly value: string) {}

  static create(raw: string): PermissionDescription {
    const value = (raw ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
    // Conta caracteres, não unidades UTF-16: um emoji vale um.
    const length = [...value].length;

    if (length < 1 || length > PermissionDescription.MAX_LENGTH) {
      throw new InvalidPermissionDescriptionError(
        `Description deve ter entre 1 e ${PermissionDescription.MAX_LENGTH} caracteres.`,
      );
    }

    return new PermissionDescription(value);
  }
}
