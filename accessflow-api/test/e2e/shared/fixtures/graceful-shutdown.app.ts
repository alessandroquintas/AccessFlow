/*
 * Processo de verdade para o teste do desligamento gracioso: a aplicação com
 * o HealthModule (PrismaModule incluso) e uma rota lenta. Imprime marcos no
 * stdout para o teste conferir a ordem. Roda com ts-node, fora do vitest.
 */
import type { AddressInfo } from 'node:net';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { EnvModule } from '@/config/env.module';
import { HealthModule } from '@/shared/infrastructure/health/health.module';
import { ShutdownState } from '@/shared/infrastructure/lifecycle/shutdown-state';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaModule } from '@/shared/infrastructure/database/prisma.module';

const say = (line: string) => process.stdout.write(`${line}\n`);

@Controller('slow')
class SlowController {
  constructor(
    private readonly shutdown: ShutdownState,
    private readonly prisma: PrismaService,
  ) {}

  /** Usa o banco no fim: prova que a conexão ainda estava lá. */
  @Get()
  async slow(): Promise<{ done: boolean }> {
    say('slow:start');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await this.prisma.$queryRaw`SELECT 1`;
    say(`slow:end shuttingDown=${this.shutdown.isShuttingDown()}`);
    return { done: true };
  }
}

@Module({
  imports: [EnvModule, PrismaModule, HealthModule],
  controllers: [SlowController],
})
class FixtureModule {}

async function main(): Promise<void> {
  // Só erros: falha ao subir aparece no stderr do teste.
  const app = await NestFactory.create(FixtureModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const disconnect = prisma.$disconnect.bind(prisma);
  prisma.$disconnect = async () => {
    say('prisma:disconnect');
    return disconnect();
  };
  app.enableShutdownHooks();
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  say(`listening:${port}`);
}

void main();
