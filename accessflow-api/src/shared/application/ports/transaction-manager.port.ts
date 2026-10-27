/**
 * Executa um trabalho numa transação.
 *
 * - Um `run` chamado dentro de outro reutiliza a transação já aberta, sem
 *   savepoint: só o `run` mais externo faz commit ou rollback.
 * - Um erro que chega ao `run` mais externo desfaz tudo e é relançado como
 *   está.
 * - Rollback-only: se um `run` interno lançar erro, a transação inteira fica
 *   marcada, mesmo que quem o chamou capture o erro e siga em frente. Quando
 *   o `run` mais externo terminar sem lançar, ele desfaz tudo e lança
 *   TransactionRolledBackError (com o erro interno em `cause`) em vez de
 *   fazer commit.
 */
export abstract class TransactionManager {
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
