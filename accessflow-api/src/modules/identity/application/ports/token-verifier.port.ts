export interface AuthenticatedIdentity {
  sub: string;
  clientId: string;
}

export abstract class TokenVerifierPort {
  abstract verify(token: string): Promise<AuthenticatedIdentity>;
}
