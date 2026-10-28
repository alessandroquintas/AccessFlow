import { describe, expect, it } from 'vitest';
import { setTimeout as sleep } from 'node:timers/promises';
import { AsyncLocalRequestContext } from '@/shared/infrastructure/request-context/async-local-request-context';

describe('AsyncLocalRequestContext', () => {
  const context = new AsyncLocalRequestContext();

  it('fora de uma requisição não há id', () => {
    expect(context.requestId()).toBeUndefined();
  });

  it('requisições intercaladas não trocam de id, e o id não vaza para fora', async () => {
    // Cada uma lê o id antes e depois de ceder a vez para a outra.
    const handle = (requestId: string, delays: number[]) =>
      context.run({ requestId }, async () => {
        const seen = [context.requestId()];
        for (const ms of delays) {
          await sleep(ms);
          seen.push(context.requestId());
        }
        return seen;
      });

    const [a, b] = await Promise.all([
      handle('req-a-000001', [5, 1, 5]),
      handle('req-b-000002', [1, 5, 1]),
    ]);

    expect(a).toEqual(Array(4).fill('req-a-000001'));
    expect(b).toEqual(Array(4).fill('req-b-000002'));
    expect(context.requestId()).toBeUndefined();
  });
});
