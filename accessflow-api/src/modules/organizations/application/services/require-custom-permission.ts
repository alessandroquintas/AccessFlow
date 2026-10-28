import { CustomPermission } from '../../domain/entities/custom-permission.entity';
import { PermissionNotFoundError } from '../../domain/errors/permission-not-found.error';
import { CustomPermissionRepository } from '../../domain/repositories/custom-permission.repository';

/**
 * Permissão personalizada da organização. Chave inexistente, de outra
 * organização, mal formada ou de sistema (não é linha da organização):
 * PermissionNotFoundError, sem distinguir os casos.
 */
export async function requireCustomPermission(
  customPermissions: CustomPermissionRepository,
  organizationId: string,
  key: string,
): Promise<CustomPermission> {
  const permission = await customPermissions.findByKey(organizationId, key);
  if (!permission) throw new PermissionNotFoundError();
  return permission;
}
