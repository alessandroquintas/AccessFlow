import { InvalidIntegrationClientError } from '../errors/invalid-integration-client.error';

/** Nome de exibição de uma integração: NFC, sem espaços nas pontas nem repetidos. */
export class IntegrationName {
  static readonly MIN_LENGTH = 2;
  static readonly MAX_LENGTH = 60;

  private constructor(readonly value: string) {}

  static create(raw: string): IntegrationName {
    const value = (raw ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
    // Em caracteres (code points), e não em unidades UTF-16.
    const length = [...value].length;

    if (
      length < IntegrationName.MIN_LENGTH ||
      length > IntegrationName.MAX_LENGTH
    ) {
      throw new InvalidIntegrationClientError(
        `name deve ter entre ${IntegrationName.MIN_LENGTH} e ${IntegrationName.MAX_LENGTH} caracteres.`,
      );
    }

    return new IntegrationName(value);
  }
}
