import type { INestApplication } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { TokenVerifierPort } from '@/modules/identity/application/ports/token-verifier.port';
import { Test } from '@nestjs/testing';
import { IdentityProfilePort } from '@/modules/identity/application/ports/identity-profile.port';
import { FakeIdentityProfileProvider } from '@test/fakes/identity/fake-identity-profile-provider';
import { MachineTokenVerifierPort } from '@/modules/identity/application/ports/machine-token-verifier.port';
import { FakeMachineTokenVerifier } from '@test/fakes/identity/fake-machine-token-verifier';
import { ClockPort } from '@/shared/application/ports/clock.port';
import { SystemClock } from '@/shared/infrastructure/clock/system-clock';
import { MachineClientProvisioner } from '@/modules/organizations/application/ports/machine-client-provisioner.port';
import { FakeMachineClientProvisioner } from '@test/fakes/organizations/fake-machine-client-provisioner';

export async function createTestApp(
  tokenVerifier: TokenVerifierPort,
  identityProfile: IdentityProfilePort = new FakeIdentityProfileProvider(),
  machineTokenVerifier: MachineTokenVerifierPort = new FakeMachineTokenVerifier(),
  clock: ClockPort = new SystemClock(),
  // Nenhum e2e chama o Cognito de verdade.
  machineClients: MachineClientProvisioner = new FakeMachineClientProvisioner(),
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TokenVerifierPort)
    .useValue(tokenVerifier)
    .overrideProvider(IdentityProfilePort)
    .useValue(identityProfile)
    .overrideProvider(MachineTokenVerifierPort)
    .useValue(machineTokenVerifier)
    .overrideProvider(ClockPort)
    .useValue(clock)
    .overrideProvider(MachineClientProvisioner)
    .useValue(machineClients)
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}
