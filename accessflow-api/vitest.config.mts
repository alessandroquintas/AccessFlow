import swc from 'unplugin-swc';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { parse } from 'dotenv';

function loadTestEnv(): Record<string, string> {
  if (!existsSync('.env.test')) return {};
  const env = parse(readFileSync('.env.test'));

  if (env.DATABASE_URL && !env.DATABASE_URL.includes('_test')) {
    throw new Error(
      'DATABASE_URL de teste precisa apontar para um banco *_test.',
    );
  }
  return env;
}

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@test': fileURLToPath(new URL('./test', import.meta.url)),
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['test/unit/**/*.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/integration/**/*.spec.ts'],
          globalSetup: ['test/integration/setup/global-setup.ts'],
          env: loadTestEnv(),
          fileParallelism: false,
        },
      },
    ],
    include: ['test/integration/**/*.spec.ts', 'test/e2e/**/*.e2e.spec.ts'],
  },
});
