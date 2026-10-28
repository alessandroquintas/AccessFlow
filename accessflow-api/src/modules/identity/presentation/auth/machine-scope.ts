/** Escopos do resource server `accessflow-api` no Cognito (infra/permanent/cognito.tf). */
export const MachineScope = {
  MEMBERS_READ: 'accessflow-api/members.read',
  AUTHORIZE: 'accessflow-api/authorize',
} as const;

export type MachineScope = (typeof MachineScope)[keyof typeof MachineScope];
