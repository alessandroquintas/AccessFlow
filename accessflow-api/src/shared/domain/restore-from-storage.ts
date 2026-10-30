import { DomainError } from './errors/domain.error';

/**
 * Reconstrói uma entidade a partir do que veio do banco. Dado que não passa
 * nas regras dela é corrupção, e não erro de quem pediu: vira Error comum
 * (500 mascarado, detalhes só no log), e não DomainError, que viraria 400.
 * As mensagens das regras não repetem o valor recebido.
 */
export function restoreFromStorage<T>(entity: string, build: () => T): T {
  try {
    return build();
  } catch (error) {
    if (error instanceof DomainError) {
      throw new Error(
        `${entity} inválido vindo do banco: ${error.code}: ${error.message}`,
        { cause: error },
      );
    }
    throw error;
  }
}
