import { InvalidCursorError } from '@/shared/application/errors/invalid-cursor.error';
import { isUuid } from '@/shared/domain/uuid';

const SEPARATOR = '|';

export interface CursorPosition {
  createdAt: Date;
  id: string;
}

export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(
    `${position.createdAt.toISOString()}${SEPARATOR}${position.id}`,
  ).toString('base64url');
}

export function decodeCursor(cursor: string): CursorPosition {
  const parts = Buffer.from(cursor, 'base64url')
    .toString('utf8')
    .split(SEPARATOR);

  if (parts.length !== 2) {
    throw new InvalidCursorError();
  }

  const [iso, id] = parts;
  const createdAt = new Date(iso);

  // Só aceita o formato exato gerado pelo encodeCursor: o Date do JS
  // também interpreta textos como "1" ou "March 7".
  if (
    !isUuid(id) ||
    Number.isNaN(createdAt.getTime()) ||
    createdAt.toISOString() !== iso
  ) {
    throw new InvalidCursorError();
  }

  return { createdAt, id };
}
