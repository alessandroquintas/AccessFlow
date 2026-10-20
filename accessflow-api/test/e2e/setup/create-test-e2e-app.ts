import type { INestApplication } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { TokenVerifierPort } from '@/modules/identity/application/ports/token-verifier.port';
import { Test } from '@nestjs/testing';
import { IdentityProfilePort } from '@/modules/identity/application/ports/identity-profile.port';
import { FakeIdentityProfileProvider } from '@test/fakes/identity/fake-identity-profile-provider';

export async function createTestApp(
  tokenVerifier: TokenVerifierPort,
  identityProfile: IdentityProfilePort = new FakeIdentityProfileProvider(),
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TokenVerifierPort)
    .useValue(tokenVerifier)
    .overrideProvider(IdentityProfilePort)
    .useValue(identityProfile)
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}
