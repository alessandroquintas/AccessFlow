import { execSync } from 'node:child_process';
import { loadTestEnv } from './test-env';

export default function setup(): void {
  const env = loadTestEnv();

  if (!env.DATABASE_URL) {
    throw new Error(
      'Crie o arquivo .env.test com DATABASE_URL para os testes de integração.',
    );
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: env.DATABASE_URL },
  });
}
