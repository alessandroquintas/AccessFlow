import { Prisma } from '@prisma/client';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * Indica violação de unicidade (P2002). Com `field`, exige também que o
 * campo apareça em `meta.target`.
 */
export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== UNIQUE_CONSTRAINT_VIOLATION
  ) {
    return false;
  }

  return (
    field === undefined || String(error.meta?.target ?? '').includes(field)
  );
}
