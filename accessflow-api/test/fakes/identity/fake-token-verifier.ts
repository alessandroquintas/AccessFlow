import { InvalidAccessTokenError } from '@/modules/identity/application/errors/invalid-access-token.error';
import {
  AuthenticatedIdentity,
  TokenVerifierPort,
} from '@/modules/identity/application/ports/token-verifier.port';

export class FakeTokenVerifier extends TokenVerifierPort {
  private readonly identities = new Map<string, AuthenticatedIdentity>();
  private unexpectedError: Error | null = null;
  /** Chamadas a `verify` desde o último `reset`. */
  calls = 0;

  register(token: string, identity: { sub: string; clientId?: string }): void {
    this.identities.set(token, { clientId: 'test-client', ...identity });
  }

  failWith(error: Error): void {
    this.unexpectedError = error;
  }

  reset(): void {
    this.identities.clear();
    this.unexpectedError = null;
    this.calls = 0;
  }

  async verify(token: string): Promise<AuthenticatedIdentity> {
    this.calls++;
    if (this.unexpectedError) {
      throw this.unexpectedError;
    }

    const identity = this.identities.get(token);
    if (!identity) {
      throw new InvalidAccessTokenError();
    }

    return identity;
  }
}
