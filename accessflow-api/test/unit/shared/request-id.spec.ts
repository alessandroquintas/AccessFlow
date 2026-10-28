import { describe, expect, it } from 'vitest';
import { resolveRequestId } from '@/shared/presentation/http/request-id';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('resolveRequestId', () => {
  it.each([
    ['8 caracteres (mínimo)', 'abcd1234'],
    ['64 caracteres (máximo)', 'a'.repeat(64)],
    ['letras, dígitos, ponto, sublinhado e hífen', 'Req.01_ab-CD'],
    ['UUID', '3f6c1a52-9b7e-4d1f-8a2b-0c9d8e7f6a5b'],
  ])('ecoa o id do cliente: %s', (_, incoming) => {
    expect(resolveRequestId(incoming)).toBe(incoming);
  });

  it.each([
    ['ausente', undefined],
    ['vazio', ''],
    ['7 caracteres', 'abc1234'],
    ['65 caracteres', 'a'.repeat(65)],
    ['com espaço', 'req 12345678'],
    ['com quebra de linha', 'req-1234\nX-Admin: 1'],
    ['com tabulação no fim', 'req-12345678\t'],
    ['com outros símbolos', 'req/1234:5678'],
    ['com acento', 'requisição-1'],
    ['cabeçalho repetido (lista)', ['req-12345678', 'req-87654321']],
  ])('troca por um UUID novo: %s', (_, incoming) => {
    const first = resolveRequestId(incoming);

    expect(first).toMatch(UUID);
    expect(resolveRequestId(incoming)).not.toBe(first);
  });
});
