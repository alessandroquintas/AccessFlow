import { BeforeApplicationShutdown, Logger } from '@nestjs/common';

/**
 * O início do desligamento. No close() do Nest, beforeApplicationShutdown
 * roda antes de o servidor HTTP fechar: a partir daqui o readiness responde
 * 503 e, durante a drenagem, o servidor ainda atende requisições novas. Só
 * depois dela o Nest fecha o HTTP (esperando as em andamento) e o Prisma
 * desconecta (onApplicationShutdown).
 */
export class ShutdownState implements BeforeApplicationShutdown {
  private readonly logger = new Logger('Shutdown');
  private shuttingDown = false;

  /** `drainMs`: SHUTDOWN_DRAIN_SECONDS, em milissegundos. */
  constructor(private readonly drainMs: number) {}

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.shuttingDown = true;
    if (this.drainMs <= 0) return;

    this.logger.log(
      `Desligando: readiness em 503; o HTTP fecha em ${this.drainMs / 1000} s.`,
    );
    await new Promise((resolve) => setTimeout(resolve, this.drainMs));
  }
}
