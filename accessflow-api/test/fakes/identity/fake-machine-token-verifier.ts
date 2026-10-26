import { InvalidAccessTokenError } from '@/modules/identity/application/errors/invalid-access-token.error';
import {
  AuthenticatedMachine,
  MachineTokenVerifierPort,
} from '@/modules/identity/application/ports/machine-token-verifier.port';

export class FakeMachineTokenVerifier extends MachineTokenVerifierPort {
  private readonly machines = new Map<string, AuthenticatedMachine>();

  register(token: string, machine: AuthenticatedMachine): void {
    this.machines.set(token, machine);
  }

  reset(): void {
    this.machines.clear();
  }

  async verify(token: string): Promise<AuthenticatedMachine> {
    const machine = this.machines.get(token);
    if (!machine) {
      throw new InvalidAccessTokenError();
    }

    return machine;
  }
}
