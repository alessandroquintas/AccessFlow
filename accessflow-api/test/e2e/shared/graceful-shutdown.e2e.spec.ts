import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { describe, expect, it } from 'vitest';

// O npm run test roda na raiz da API, onde estão o tsconfig e o node_modules.
const API_ROOT = process.cwd();
const FIXTURE = 'test/e2e/shared/fixtures/graceful-shutdown.app.ts';

/** Sobe a fixture num processo próprio e acompanha os marcos do stdout. */
async function startFixture(env: Record<string, string> = {}) {
  const child = spawn(
    process.execPath,
    [
      '-r',
      'ts-node/register/transpile-only',
      '-r',
      'tsconfig-paths/register',
      FIXTURE,
    ],
    {
      cwd: API_ROOT,
      // A DATABASE_URL do accessflow_test, a mesma deste processo.
      env: { ...process.env, TS_NODE_PROJECT: 'tsconfig.json', ...env },
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
  const lines: string[] = [];
  const waiters: [string, () => void][] = [];
  createInterface({ input: child.stdout }).on('line', (line) => {
    lines.push(line);
    for (const [prefix, resolve] of waiters) {
      if (line.startsWith(prefix)) resolve();
    }
  });
  const seen = (prefix: string) =>
    lines.some((l) => l.startsWith(prefix))
      ? Promise.resolve()
      : new Promise<void>((resolve) => waiters.push([prefix, resolve]));
  const exited = once(child, 'exit') as Promise<[number | null, string | null]>;

  await seen('listening:');
  const port = lines
    .find((l) => l.startsWith('listening:'))!
    .slice('listening:'.length);

  return {
    child,
    lines,
    seen,
    exited,
    url: (path: string) => `http://127.0.0.1:${port}${path}`,
    stop: () => {
      if (child.exitCode === null && child.signalCode === null) child.kill();
    },
  };
}

describe('Desligamento gracioso (processo de verdade)', () => {
  it('SIGTERM com requisição lenta em andamento: ela termina com 200, depois o Prisma desconecta e o processo encerra', async () => {
    const app = await startFixture();
    try {
      const slow = fetch(app.url('/slow'));
      await app.seen('slow:start');

      app.lines.push('-- SIGTERM');
      app.child.kill('SIGTERM');
      const res = await slow;
      app.lines.push(`-- resposta ${res.status}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ done: true });

      const [code, signal] = await app.exited;
      // O Nest reenvia o sinal a si mesmo depois do close().
      expect(signal ?? code).toBe('SIGTERM');
      expect(app.lines.filter((l) => !l.startsWith('listening:'))).toEqual([
        'slow:start',
        '-- SIGTERM',
        'slow:end shuttingDown=true',
        '-- resposta 200',
        'prisma:disconnect',
      ]);
    } finally {
      app.stop();
    }
  }, 30_000);

  it('com SHUTDOWN_DRAIN_SECONDS=2: durante a drenagem o readiness é 503 e requisição nova ainda é atendida; depois fecha', async () => {
    const app = await startFixture({ SHUTDOWN_DRAIN_SECONDS: '2' });
    try {
      const before = await fetch(app.url('/health/ready'));
      expect(before.status).toBe(200);

      const signaledAt = Date.now();
      app.child.kill('SIGTERM');
      // Dentro da drenagem: o servidor ainda aceita conexões novas.
      await new Promise((resolve) => setTimeout(resolve, 300));
      const ready = await fetch(app.url('/health/ready'));
      const live = await fetch(app.url('/health'));
      const slow = await fetch(app.url('/slow'));
      expect(app.lines).not.toContain('prisma:disconnect');

      expect([ready.status, await ready.json()]).toEqual([
        503,
        { status: 'unavailable' },
      ]);
      expect(live.status).toBe(200);
      expect([slow.status, await slow.json()]).toEqual([200, { done: true }]);

      const [code, signal] = await app.exited;
      expect(signal ?? code).toBe('SIGTERM');
      expect(Date.now() - signaledAt).toBeGreaterThanOrEqual(2000);
      expect(app.lines.at(-1)).toBe('prisma:disconnect');
      // Depois de fechar, ninguém mais atende.
      await expect(fetch(app.url('/health'))).rejects.toThrow();
    } finally {
      app.stop();
    }
  }, 30_000);
});
