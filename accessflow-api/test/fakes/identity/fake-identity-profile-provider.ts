import {
  IdentityProfile,
  IdentityProfilePort,
} from '@/modules/identity/application/ports/identity-profile.port';
import { InvalidAccessTokenError } from '@/modules/identity/application/errors/invalid-access-token.error';

export class FakeIdentityProfileProvider extends IdentityProfilePort {
  private readonly profiles = new Map<string, IdentityProfile>();
  calls = 0;

  register(
    token: string,
    profile: { sub: string; email: string; emailVerified?: boolean },
  ): void {
    this.profiles.set(token, { emailVerified: true, ...profile });
  }

  reset(): void {
    this.profiles.clear();
    this.calls = 0;
  }

  async getProfile(accessToken: string): Promise<IdentityProfile> {
    this.calls++;
    const profile = this.profiles.get(accessToken);
    if (!profile) throw new InvalidAccessTokenError();

    return profile;
  }
}
