import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { DatabaseHealthPort } from '@/shared/application/ports/database-health.port';
import { ShutdownState } from '@/shared/infrastructure/lifecycle/shutdown-state';

/** Prazo do `SELECT 1` do readiness. */
export const READINESS_TIMEOUT_MS = 1000;

interface HealthBody {
  status: 'ok' | 'unavailable';
}

/**
 * Sondas do balanceador e do orquestrador: sem autenticação, fora do
 * Swagger, sem detalhes no corpo. O 503 do readiness é uma resposta, e não
 * um erro: não passa pelo filtro nem vai para o log a cada chamada.
 */
@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseHealthPort,
    private readonly shutdown: ShutdownState,
  ) {}

  /** Liveness: o processo responde. Não toca no banco. */
  @Get()
  live(): HealthBody {
    return { status: 'ok' };
  }

  /** Readiness: pode receber tráfego. 503 se o banco falhar ou se estiver desligando. */
  @Get('ready')
  async ready(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthBody> {
    const ready =
      !this.shutdown.isShuttingDown() &&
      (await this.database.ping(READINESS_TIMEOUT_MS)) &&
      // O desligamento pode ter começado durante o ping.
      !this.shutdown.isShuttingDown();

    if (ready) return { status: 'ok' };
    response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: 'unavailable' };
  }
}
