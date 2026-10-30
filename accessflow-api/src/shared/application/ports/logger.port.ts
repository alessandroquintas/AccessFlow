/**
 * Log operacional do que não volta para quem chamou (uma compensação que
 * falhou, por exemplo). Cada linha leva o id de correlação da requisição.
 * Nunca segredos nem dados pessoais: ids bastam.
 */
export abstract class LoggerPort {
  abstract warn(message: string): void;
  abstract error(message: string, error?: unknown): void;
}
