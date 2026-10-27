import { describe, expect, it } from 'vitest';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { InvalidEmailError } from '@/shared/domain/errors/invalid-email.error';

describe('Email', () => {
  it('normaliza para minúsculas e remove espaços nas pontas', () => {
    expect(Email.create('  Ana.Souza@Example.COM ').value).toBe(
      'ana.souza@example.com',
    );
  });

  it.each([
    ['vazio', ''],
    ['só espaços', '   '],
    ['sem arroba', 'ana.example.com'],
    ['sem domínio', 'ana@'],
    ['sem ponto no domínio', 'ana@example'],
    ['espaço interno', 'ana souza@example.com'],
    ['longo demais', `${'a'.repeat(243)}@example.com`],
  ])('recusa %s com INVALID_EMAIL', (_cenario, raw) => {
    const attempt = () => Email.create(raw);

    expect(attempt).toThrow(InvalidEmailError);
    expect(attempt).toThrow(expect.objectContaining({ code: 'INVALID_EMAIL' }));
  });

  it('aceita o tamanho máximo de 254 caracteres', () => {
    const raw = `${'a'.repeat(242)}@example.com`;

    expect(Email.create(raw).value).toHaveLength(254);
  });

  it('a mensagem de erro não repete o valor recebido', () => {
    expect(() => Email.create('segredo@')).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining('segredo'),
      }),
    );
  });

  it('compara pelo valor normalizado', () => {
    expect(
      Email.create('ANA@example.com').equals(Email.create('ana@example.com')),
    ).toBe(true);
  });
});
