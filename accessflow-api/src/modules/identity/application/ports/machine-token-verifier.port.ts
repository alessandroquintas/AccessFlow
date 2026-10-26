export interface AuthenticatedMachine {
  clientId: string;
  scopes: string[];
}

/**
 * Verifica tokens de máquina (client credentials). A allowlist de clients é
 * separada da de usuários: um token de usuário nunca passa aqui.
 */
export abstract class MachineTokenVerifierPort {
  abstract verify(token: string): Promise<AuthenticatedMachine>;
}
