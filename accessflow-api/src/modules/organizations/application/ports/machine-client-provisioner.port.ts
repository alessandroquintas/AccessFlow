import { MachineScope } from '@/shared/domain/machine-scope';

/** Prefixo do nome de todo app client criado pelo painel. */
export const MACHINE_CLIENT_NAME_PREFIX = 'accessflow-int-';

/** Nome do app client de uma integração: o prefixo mais o id da linha. */
export function machineClientName(integrationId: string): string {
  return `${MACHINE_CLIENT_NAME_PREFIX}${integrationId}`;
}

export interface ProvisionedMachineClient {
  clientId: string;
  /** Existe só na resposta da criação: nunca gravar, logar nem auditar. */
  clientSecret: string;
}

export interface MachineClientSummary {
  clientId: string;
  name: string;
}

/** App clients de máquina (client credentials) no provedor de identidade. */
export abstract class MachineClientProvisioner {
  abstract create(input: {
    name: string;
    scopes: readonly MachineScope[];
  }): Promise<ProvisionedMachineClient>;

  /** Idempotente: um client que já não existe não é erro. */
  abstract delete(clientId: string): Promise<void>;

  /** Os clients cujo nome começa com o prefixo; nenhum outro. */
  abstract listByPrefix(prefix: string): Promise<MachineClientSummary[]>;
}
