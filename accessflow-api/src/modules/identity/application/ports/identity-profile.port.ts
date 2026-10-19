export interface IdentityProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
}

export abstract class IdentityProfilePort {
  abstract getProfile(accessToken: string): Promise<IdentityProfile>;
}
