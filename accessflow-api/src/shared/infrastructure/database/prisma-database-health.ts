import { Injectable, Logger } from '@nestjs/common';
import { DatabaseHealthPort } from '@/shared/application/ports/database-health.port';
import { PrismaService } from './prisma.service';

/**
 * `SELECT 1` com prazo. Só a mudança de estado vai para o log (o readiness é
 * chamado a cada poucos segundos), com o motivo, que não traz a URL do banco.
 */
@Injectable()
export class PrismaDatabaseHealth extends DatabaseHealthPort {
  private readonly logger = new Logger('Health');
  private healthy = true;

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async ping(timeoutMs: number): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`sem resposta em ${timeoutMs} ms`)),
        timeoutMs,
      );
    });

    try {
      // A consulta segue no pool se o prazo vencer; o resultado é ignorado.
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);
      this.changeTo(true);
      return true;
    } catch (error) {
      this.changeTo(false, error);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  private changeTo(healthy: boolean, error?: unknown): void {
    if (healthy === this.healthy) return;
    this.healthy = healthy;
    if (healthy) {
      this.logger.log('Banco voltou a responder.');
    } else {
      this.logger.warn(
        `Banco sem resposta: ${error instanceof Error ? (error.message.trim().split('\n').at(-1) ?? '') : 'motivo desconhecido'}`,
      );
    }
  }
}
