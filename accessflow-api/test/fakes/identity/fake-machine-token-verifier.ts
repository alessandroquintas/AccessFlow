import { InvalidAccessTokenError } from '@/modules/identity/application/errors/invalid-access-token.error';
import {
  AuthenticatedMachine,
  MachineTokenVerifierPort,
} from '@/modules/identity/application/ports/machine-token-verifier.port';

export class FakeMachineTokenVerifier extends MachineTokenVerifierPort {
  private readonly machines = new Map<string, AuthenticatedMachine>();
  private unexpectedError: Error | null = null;

  register(token: string, machine: AuthenticatedMachine): void {
    this.machines.set(token, machine);
  }

  failWith(error: Error): void {
    this.unexpectedError = error;
  }

  reset(): void {
    this.machines.clear();
    this.unexpectedError = null;
  }

  async verify(token: string): Promise<AuthenticatedMachine> {
    if (this.unexpectedError) {
      throw this.unexpectedError;
    }

    const machine = this.machines.get(token);
    if (!machine) {
      throw new InvalidAccessTokenError();
    }

    return machine;
  }
}
