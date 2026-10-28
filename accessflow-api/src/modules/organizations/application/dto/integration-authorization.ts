import { PermissionDecision } from '../../policies/authorization';

export interface IntegrationAuthorization {
  organizationId: string;
  userId: string;
  /** true só se todas as chaves forem permitidas. */
  allowed: boolean;
  /** Na ordem do pedido, sem as repetidas. */
  results: PermissionDecision[];
}
