import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';

export function loadTestEnv(): Record<string, string> {
  const path = '.env.test';
  if (!existsSync(path)) return {};

  const env = parse(readFileSync(path));

  if (env.DATABASE_URL && !env.DATABASE_URL.includes('_test')) {
    throw new Error(
      'DATABASE_URL de teste precisa apontar para um banco *_test.',
    );
  }

  return env;
}
