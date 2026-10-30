export interface AuthenticatedMachine {
  clientId: string;
  scopes: string[];
}

/**
 * Verifica tokens de máquina (client credentials) de qualquer app client do
 * pool. Um token de usuário nunca passa aqui. Autenticar não autoriza: o
 * vínculo do client em integration_clients e os escopos da rota decidem.
 */
export abstract class MachineTokenVerifierPort {
  abstract verify(token: string): Promise<AuthenticatedMachine>;
}
