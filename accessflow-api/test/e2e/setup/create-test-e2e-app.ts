import type { INestApplication } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { TokenVerifierPort } from '@/modules/identity/application/ports/token-verifier.port';
import { Test } from '@nestjs/testing';

export async function createTestApp(
  tokenVerifier: TokenVerifierPort,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TokenVerifierPort)
    .useValue(tokenVerifier)
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}
