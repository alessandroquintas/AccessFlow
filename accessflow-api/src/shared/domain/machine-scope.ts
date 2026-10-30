/**
 * Escopos do resource server `accessflow-api` no Cognito
 * (infra/permanent/cognito.tf): o catálogo do que um token de máquina pode
 * ter e do que uma integração pode receber.
 */
export const MachineScope = {
  MEMBERS_READ: 'accessflow-api/members.read',
  AUTHORIZE: 'accessflow-api/authorize',
} as const;

export type MachineScope = (typeof MachineScope)[keyof typeof MachineScope];

const SCOPES: readonly string[] = Object.values(MachineScope);

export function isMachineScope(value: string): value is MachineScope {
  return SCOPES.includes(value);
}

/** Ordem estável para gravar e exibir: a do catálogo. */
export function sortMachineScopes(
  scopes: readonly MachineScope[],
): MachineScope[] {
  return [...scopes].sort((a, b) => SCOPES.indexOf(a) - SCOPES.indexOf(b));
}
