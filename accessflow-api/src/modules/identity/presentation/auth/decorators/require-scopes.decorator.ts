import { SetMetadata } from '@nestjs/common';
import type { MachineScope } from '../machine-scope';

export const REQUIRED_SCOPES_KEY = 'requiredScopes';

/** Escopos que o token de máquina precisa ter, todos ao mesmo tempo. */
export const RequireScopes = (...scopes: MachineScope[]) =>
  SetMetadata(REQUIRED_SCOPES_KEY, scopes);
