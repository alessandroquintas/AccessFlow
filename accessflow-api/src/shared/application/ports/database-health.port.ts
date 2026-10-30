/** Se o banco responde, para o readiness. */
export abstract class DatabaseHealthPort {
  /** true se o banco respondeu dentro de `timeoutMs`. Nunca lança. */
  abstract ping(timeoutMs: number): Promise<boolean>;
}
