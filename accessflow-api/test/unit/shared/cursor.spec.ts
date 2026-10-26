import { describe, expect, it } from 'vitest';
import {
  decodeCursor,
  encodeCursor,
} from '@/shared/presentation/graphql/pagination/cursor';
import { clampPageSize } from '@/shared/presentation/graphql/pagination/page-size';
import { InvalidCursorError } from '@/shared/application/errors/invalid-cursor.error';

const ID = '6f1c2a3e-0000-4000-8000-000000000001';

function toCursor(raw: string): string {
  return Buffer.from(raw).toString('base64url');
}

describe('Cursor de paginação', () => {
  it('decodifica o que o encode gerou (ida e volta)', () => {
    const position = {
      createdAt: new Date('2026-10-26T12:34:56.789Z'),
      id: ID,
    };

    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it.each([
    ['base64 sem sentido', 'isso-nao-e-um-cursor'],
    ['id que não é UUID', toCursor('2026-10-26T12:34:56.789Z|abc')],
    ['data inválida', toCursor(`nao-e-data|${ID}`)],
    ['data fora do formato ISO', toCursor(`1|${ID}`)],
    ['sem separador', toCursor(`2026-10-26T12:34:56.789Z${ID}`)],
    ['sem id', toCursor('2026-10-26T12:34:56.789Z|')],
    ['partes a mais', toCursor(`2026-10-26T12:34:56.789Z|${ID}|extra`)],
    ['cursor vazio', ''],
  ])('recusa %s', (_cenario, cursor) => {
    expect(() => decodeCursor(cursor)).toThrow(InvalidCursorError);
  });
});

describe('clampPageSize', () => {
  it.each([
    [undefined, 20],
    [null, 20],
    [10, 10],
    [1, 1],
    [50, 50],
    [0, 1],
    [-5, 1],
    [51, 50],
    [1000, 50],
    [10.9, 10],
  ])('first = %s → %s', (first, expected) => {
    expect(clampPageSize(first)).toBe(expected);
  });
});
