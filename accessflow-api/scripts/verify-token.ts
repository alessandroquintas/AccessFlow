import 'dotenv/config';
import { CognitoTokenVerifier } from '@/modules/identity/infrastructure/cognito/cognito-token.verifier';

async function main(): Promise<void> {
  const token = process.env.ACCESS_TOKEN;
  if (!token) throw new Error('Defina a variável ACCESS_TOKEN.');

  const verifier = new CognitoTokenVerifier({
    userPoolId: process.env.COGNITO_USER_POOL_ID ?? '',
    clientIds: (process.env.COGNITO_CLIENT_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  });

  const identity = await verifier.verify(token);
  console.log('Token válido:', identity);
}

main().catch((error: Error) => {
  console.error(`${error.name}: ${error.message}`);
  process.exit(1);
});
