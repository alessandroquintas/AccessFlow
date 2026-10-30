import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { NestLogger } from '@/shared/infrastructure/logging/nest-logger';
import { AsyncLocalRequestContext } from '@/shared/infrastructure/request-context/async-local-request-context';

describe('NestLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('põe o requestId da requisição à frente; fora dela, "-"', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockReturnValue();
    const error = vi.spyOn(Logger.prototype, 'error').mockReturnValue();
    const context = new AsyncLocalRequestContext();
    const sut = new NestLogger('Teste', context);
    const cause = new Error('motivo');

    context.run({ requestId: 'req-12345678' }, () => {
      sut.warn('aviso');
      sut.error('falhou', cause);
    });
    sut.error('sem requisição');

    expect(warn.mock.calls).toEqual([['requestId=req-12345678 aviso']]);
    expect(error.mock.calls).toEqual([
      ['requestId=req-12345678 falhou', cause],
      ['requestId=- sem requisição'],
    ]);
  });
});
