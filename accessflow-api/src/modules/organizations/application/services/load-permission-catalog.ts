import { CustomPermissionRepository } from '../../domain/repositories/custom-permission.repository';
import { PermissionCatalog } from '../../policies/organization-permission';

/**
 * Catálogo efetivo da organização: sistema mais as personalizadas dela. Para
 * validar uma escrita, chame dentro da transação, depois de travar a
 * organização: toda escrita de permissão personalizada trava a organização.
 */
export async function loadPermissionCatalog(
  customPermissions: CustomPermissionRepository,
  organizationId: string,
): Promise<PermissionCatalog> {
  const custom = await customPermissions.listByOrganization(organizationId);
  return PermissionCatalog.withCustom(custom.map((p) => p.key));
}
