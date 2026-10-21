import { InvalidOrganizationError } from '../errors/invalid-organization.error';

export class OrganizationName {
  static readonly MIN_LENGHT = 2;
  static readonly MAX_LENGHT = 100;

  private constructor(readonly value: string) {}

  static create(raw: string): OrganizationName {
    const value = raw?.trim() ?? '';

    if (
      value.length < OrganizationName.MIN_LENGHT ||
      value.length > OrganizationName.MAX_LENGHT
    ) {
      throw new InvalidOrganizationError(
        `Name deve ter entre ${OrganizationName.MIN_LENGHT} e ${OrganizationName.MAX_LENGHT} caracteres.`,
      );
    }

    return new OrganizationName(value);
  }
}
