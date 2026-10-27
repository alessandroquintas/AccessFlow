/**
 * O `run` externo terminou sem erro, mas um `run` interno tinha falhado e o
 * erro foi capturado no caminho: a transação foi desfeita em vez de ir para
 * commit. Não é erro de negócio; indica código que engoliu uma falha.
 */
export class TransactionRolledBackError extends Error {
  constructor(cause: unknown) {
    // Só o nome da classe: a mensagem do erro original pode ter dados.
    const origin = cause instanceof Error ? ` (${cause.name})` : '';
    super(
      `Transação desfeita: um trecho interno falhou${origin} e o erro foi capturado.`,
      { cause },
    );
    this.name = new.target.name;
  }
}
