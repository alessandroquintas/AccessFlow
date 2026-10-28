import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/** O que o cliente pode mandar: sem espaço, quebra de linha ou outros símbolos. */
const ACCEPTED = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * O id de correlação da requisição: o do cliente, se tiver um formato
 * seguro para logs e cabeçalhos; senão (ausente, inválido ou repetido), um
 * UUID novo.
 */
export function resolveRequestId(
  incoming: string | string[] | undefined,
): string {
  return typeof incoming === 'string' && ACCEPTED.test(incoming)
    ? incoming
    : randomUUID();
}
