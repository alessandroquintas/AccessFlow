import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import type { Response } from 'express';
import { DatabaseHealthPort } from '@/shared/application/ports/database-health.port';
import { ShutdownState } from '@/shared/infrastructure/lifecycle/shutdown-state';
import { PrismaDatabaseHealth } from '@/shared/infrastructure/database/prisma-database-health';
import type { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import {
  HealthController,
  READINESS_TIMEOUT_MS,
} from '@/shared/presentation/http/health.controller';

class FakeDatabaseHealth extends DatabaseHealthPort {
  answer = true;
  timeouts: number[] = [];
  onPing: () => void = () => undefined;

  async ping(timeoutMs: number): Promise<boolean> {
    this.timeouts.push(timeoutMs);
    this.onPing();
    return this.answer;
  }
}

function fakeResponse() {
  const response = { statusCode: 200, status: vi.fn() };
  response.status.mockImplementation((code: number) => {
    response.statusCode = code;
    return response;
  });
  return response;
}

describe('HealthController', () => {
  const setup = () => {
    const database = new FakeDatabaseHealth();
    const shutdown = new ShutdownState(0);
    return {
      database,
      shutdown,
      sut: new HealthController(database, shutdown),
    };
  };

  it('liveness: ok, sem tocar no banco', () => {
    const { database, sut } = setup();

    expect(sut.live()).toEqual({ status: 'ok' });
    expect(database.timeouts).toEqual([]);
  });

  it('readiness: ok com o banco respondendo, com prazo de 1 s', async () => {
    const { database, sut } = setup();
    const response = fakeResponse();

    expect(await sut.ready(response as unknown as Response)).toEqual({
      status: 'ok',
    });
    expect(response.statusCode).toBe(200);
    expect(database.timeouts).toEqual([READINESS_TIMEOUT_MS]);
    expect(READINESS_TIMEOUT_MS).toBe(1000);
  });

  it('readiness: 503 sem detalhes com o banco fora', async () => {
    const { database, sut } = setup();
    database.answer = false;
    const response = fakeResponse();

    expect(await sut.ready(response as unknown as Response)).toEqual({
      status: 'unavailable',
    });
    expect(response.statusCode).toBe(503);
  });

  it('readiness: 503 desligando, sem nem consultar o banco', async () => {
    const { database, shutdown, sut } = setup();
    await shutdown.beforeApplicationShutdown();
    const response = fakeResponse();

    expect(await sut.ready(response as unknown as Response)).toEqual({
      status: 'unavailable',
    });
    expect(response.statusCode).toBe(503);
    expect(database.timeouts).toEqual([]);
  });

  it('readiness: 503 se o desligamento começar durante a consulta', async () => {
    const { database, shutdown, sut } = setup();
    database.onPing = () => void shutdown.beforeApplicationShutdown();
    const response = fakeResponse();

    await sut.ready(response as unknown as Response);

    expect(response.statusCode).toBe(503);
  });
});

describe('ShutdownState', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('marca o desligamento na hora e só termina depois da drenagem', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.useFakeTimers();
    const sut = new ShutdownState(2000);
    let drained = false;

    const done = sut.beforeApplicationShutdown().then(() => (drained = true));
    expect(sut.isShuttingDown()).toBe(true);
    await vi.advanceTimersByTimeAsync(1999);
    expect(drained).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(drained).toBe(true);
  });

  it('sem drenagem, termina na hora', async () => {
    const sut = new ShutdownState(0);

    await sut.beforeApplicationShutdown();

    expect(sut.isShuttingDown()).toBe(true);
  });
});

describe('PrismaDatabaseHealth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const health = (query: () => Promise<unknown>) =>
    new PrismaDatabaseHealth({
      $queryRaw: query,
    } as unknown as PrismaService);

  it('true quando o SELECT 1 responde', async () => {
    expect(await health(async () => [{ '?column?': 1 }]).ping(1000)).toBe(true);
  });

  it('false quando o banco falha, e false quando passa do prazo', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.useFakeTimers();
    const failing = health(async () => {
      throw new Error('conexão recusada');
    });
    const hanging = health(() => new Promise(() => undefined));

    expect(await failing.ping(1000)).toBe(false);
    const pending = hanging.ping(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toBe(false);
  });

  it('só a mudança de estado vai para o log', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const log = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    let up = false;
    const sut = health(async () => {
      if (!up) throw new Error('conexão recusada');
      return [];
    });

    for (let i = 0; i < 3; i++) await sut.ping(1000);
    up = true;
    for (let i = 0; i < 3; i++) await sut.ping(1000);

    expect(warn.mock.calls).toEqual([['Banco sem resposta: conexão recusada']]);
    expect(log.mock.calls).toEqual([['Banco voltou a responder.']]);
  });
});
