import type { Request } from 'express';
import type { AuthenticatedIdentity } from '@/modules/identity/application/ports/token-verifier.port';
import type { AuthenticatedMachine } from '@/modules/identity/application/ports/machine-token-verifier.port';

export type AuthenticatedRequest = Request & {
  identity?: AuthenticatedIdentity;
  accessToken?: string;
  machine?: AuthenticatedMachine;
};
