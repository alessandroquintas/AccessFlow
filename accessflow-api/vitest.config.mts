import swc from 'unplugin-swc';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { loadTestEnv } from './test/integration/setup/test-env.js';

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
  },
});
