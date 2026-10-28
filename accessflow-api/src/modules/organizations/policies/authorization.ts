import { Role } from '../domain/entities/role.entity';
import { PermissionCatalog } from './organization-permission';

export interface PermissionDecision {
  permission: string;
  allowed: boolean;
}

/**
 * Decide cada chave pedida. A chave precisa existir no catálogo efetivo
 * ANTES do grants(): o OWNER concede qualquer chave, até uma inexistente.
 * Sem papel (não membro, membro removido ou conta desativada), tudo false.
 */
export function decidePermissions(
  role: Role | null,
  catalog: PermissionCatalog,
  permissions: readonly string[],
): PermissionDecision[] {
  return permissions.map((permission) => ({
    permission,
    allowed:
      role !== null && catalog.has(permission) && role.grants(permission),
  }));
}
