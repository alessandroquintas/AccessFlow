/**
 * Credenciais de fachada para o diálogo do segredo: obviamente falsas, para
 * ninguém confundir com uma real. Fase 11b: some (vêm da resposta do
 * `createIntegrationClient`).
 */
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

const random = (length: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) => ALPHABET[byte % ALPHABET.length]).join("");

/** client_id no formato do Cognito: 26 caracteres. */
export const fakeClientId = () => random(26);

export const fakeClientSecret = () => `DEMO-nao-e-um-segredo-real-${random(24)}`;
