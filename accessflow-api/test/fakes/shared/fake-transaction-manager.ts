import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';

/** Executa o trabalho direto: os repositórios em memória não têm rollback. */
export class FakeTransactionManager extends TransactionManager {
  async run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
