import { describe, expect, it } from 'vitest';
import { validateEnv } from '@/config/env.validation';

const VALID = {
  DATABASE_URL: 'postgresql://localhost:5433/accessflow',
  COGNITO_USER_POOL_ID: 'us-east-1_TestPool1',
  COGNITO_CLIENT_IDS: 'client-web, client-cli',
  COGNITO_MACHINE_CLIENT_IDS: 'client-integracao',
};

describe('Validação do ambiente', () => {
  it('separa as listas de clients de usuário e de máquina', () => {
    const env = validateEnv(VALID);

    expect(env.COGNITO_CLIENT_IDS).toEqual(['client-web', 'client-cli']);
    expect(env.COGNITO_MACHINE_CLIENT_IDS).toEqual(['client-integracao']);
  });

  it.each([
    ['ausente', undefined],
    ['vazia', ''],
    ['só vírgulas', ' , '],
  ])(
    'exige ao menos um client de máquina (lista %s)',
    (_cenario, COGNITO_MACHINE_CLIENT_IDS) => {
      expect(() =>
        validateEnv({ ...VALID, COGNITO_MACHINE_CLIENT_IDS }),
      ).toThrow(/COGNITO_MACHINE_CLIENT_IDS/);
    },
  );

  it('recusa um client presente nas duas listas', () => {
    expect(() =>
      validateEnv({
        ...VALID,
        COGNITO_MACHINE_CLIENT_IDS: 'client-integracao,client-web',
      }),
    ).toThrow(/não pode estar em COGNITO_CLIENT_IDS/);
  });
});
