/**
 * Executa um trabalho numa transação. Um `run` chamado dentro de outro
 * reutiliza a transação já aberta: quem a abriu decide o commit, e um erro
 * em qualquer ponto desfaz tudo.
 */
export abstract class TransactionManager {
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
