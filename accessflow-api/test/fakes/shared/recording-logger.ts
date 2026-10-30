import { LoggerPort } from '@/shared/application/ports/logger.port';

/** Guarda cada linha como o log a imprimiria, com a pilha do erro. */
export class RecordingLogger extends LoggerPort {
  readonly lines: string[] = [];

  warn(message: string): void {
    this.lines.push(message);
  }

  error(message: string, error?: unknown): void {
    const detail =
      error instanceof Error ? (error.stack ?? error.message) : error;
    this.lines.push(
      detail === undefined ? message : `${message} ${String(detail)}`,
    );
  }
}
