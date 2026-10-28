import { CustomPermissionRepository } from '../../domain/repositories/custom-permission.repository';
import { PermissionCatalog } from '../../policies/organization-permission';
import { loadPermissionCatalog } from '../services/load-permission-catalog';

/**
 * Catálogo efetivo de uma organização, sem checar acesso. Só o
 * `permissions` do OrganizationRole do OWNER chega aqui, e OrganizationRole
 * só sai em operações de papel (roles:read ou roles:manage) e no papel do
 * próprio viewer. Antes de usar em outro caminho, garanta o acesso.
 */
export class GetPermissionCatalogUseCase {
  constructor(private readonly customPermissions: CustomPermissionRepository) {}

  execute(organizationId: string): Promise<PermissionCatalog> {
    return loadPermissionCatalog(this.customPermissions, organizationId);
  }
}
