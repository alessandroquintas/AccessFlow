import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { DatabaseHealthPort } from '@/shared/application/ports/database-health.port';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaDatabaseHealth } from '@/shared/infrastructure/database/prisma-database-health';
import { ShutdownState } from '@/shared/infrastructure/lifecycle/shutdown-state';

async function createApp(database?: DatabaseHealthPort) {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (database) {
    builder = builder.overrideProvider(DatabaseHealthPort).useValue(database);
  }
  const app = (await builder.compile()).createNestApplication();
  await app.init();
  return app;
}

describe('Health check (e2e)', () => {
  let app: INestApplication | undefined;
  let unreachable: PrismaClient | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    await unreachable?.$disconnect();
    app = unreachable = undefined;
  });

  it('liveness e readiness: 200, sem autenticação, sem evento de segurança nem log por chamada', async () => {
    app = await createApp();
    const prisma = app.get(PrismaService);
    await prisma.$executeRaw`TRUNCATE TABLE "security_events"`;
    const logs = (['log', 'warn', 'error'] as const).map((level) =>
      vi.spyOn(Logger.prototype, level).mockImplementation(() => undefined),
    );

    for (let i = 0; i < 3; i++) {
      const live = await request(app.getHttpServer()).get('/health');
      const ready = await request(app.getHttpServer()).get('/health/ready');

      expect([live.status, live.body]).toEqual([200, { status: 'ok' }]);
      expect([ready.status, ready.body]).toEqual([200, { status: 'ok' }]);
    }
    expect(await prisma.securityEvent.count()).toBe(0);
    for (const spy of logs) expect(spy).not.toHaveBeenCalled();
  });

  it('fora do Swagger', async () => {
    app = await createApp();

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );

    expect(
      Object.keys(document.paths).filter((p) => p.includes('health')),
    ).toEqual([]);
  });

  it('desligando: readiness 503 sem detalhes; liveness continua 200', async () => {
    app = await createApp();

    await app.get(ShutdownState).beforeApplicationShutdown();
    const ready = await request(app.getHttpServer()).get('/health/ready');
    const live = await request(app.getHttpServer()).get('/health');

    expect([ready.status, ready.body]).toEqual([
      503,
      { status: 'unavailable' },
    ]);
    expect(live.status).toBe(200);
  });

  it('banco fora: readiness 503 sem detalhes, e uma linha de WARN só na mudança', async () => {
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = '/accessflow_inexistente_test';
    unreachable = new PrismaClient({
      datasources: { db: { url: url.toString() } },
    });
    app = await createApp(
      new PrismaDatabaseHealth(unreachable as unknown as PrismaService),
    );
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const first = await request(app.getHttpServer()).get('/health/ready');
    const second = await request(app.getHttpServer()).get('/health/ready');

    for (const res of [first, second]) {
      expect([res.status, res.body]).toEqual([503, { status: 'unavailable' }]);
      expect(JSON.stringify(res.body)).not.toContain('inexistente');
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/^Banco sem resposta: /);
  });
});
