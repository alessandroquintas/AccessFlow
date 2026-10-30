import { describe, expect, it } from 'vitest';
import { validateEnv } from '@/config/env.validation';

const VALID = {
  DATABASE_URL: 'postgresql://localhost:5433/accessflow',
  COGNITO_USER_POOL_ID: 'us-east-1_TestPool1',
  COGNITO_CLIENT_IDS: 'client-web, client-cli',
};

describe('Validação do ambiente', () => {
  it('lê a lista de clients de usuário', () => {
    expect(validateEnv(VALID).COGNITO_CLIENT_IDS).toEqual([
      'client-web',
      'client-cli',
    ]);
  });

  it('COGNITO_MACHINE_CLIENT_IDS não existe mais; um .env antigo com ela continua válido', () => {
    const env = validateEnv({
      ...VALID,
      COGNITO_MACHINE_CLIENT_IDS: 'client-integracao',
    });

    expect(env).not.toHaveProperty('COGNITO_MACHINE_CLIENT_IDS');
  });

  it('SHUTDOWN_DRAIN_SECONDS: opcional, padrão 0, inteiro de 0 a 60', () => {
    expect(validateEnv(VALID).SHUTDOWN_DRAIN_SECONDS).toBe(0);
    expect(
      validateEnv({ ...VALID, SHUTDOWN_DRAIN_SECONDS: '60' })
        .SHUTDOWN_DRAIN_SECONDS,
    ).toBe(60);
    for (const value of ['-1', '61', '1.5', 'dez']) {
      expect(() =>
        validateEnv({ ...VALID, SHUTDOWN_DRAIN_SECONDS: value }),
      ).toThrow(/SHUTDOWN_DRAIN_SECONDS/);
    }
  });
});
