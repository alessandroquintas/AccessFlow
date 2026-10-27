import { isUuid } from '@/shared/domain/uuid';
import { Role } from '../../domain/entities/role.entity';
import { RoleNotFoundError } from '../../domain/errors/role-not-found.error';
import { RoleRepository } from '../../domain/repositories/role.repository';

/**
 * Papel não apagado da organização. Id malformado, inexistente, apagado ou
 * de outra organização: RoleNotFoundError, sem distinguir os casos.
 */
export async function requireRole(
  roles: RoleRepository,
  organizationId: string,
  roleId: string,
): Promise<Role> {
  const id = roleId.toLowerCase();
  if (!isUuid(id)) throw new RoleNotFoundError();

  const role = await roles.findById(organizationId, id);
  if (!role) throw new RoleNotFoundError();

  return role;
}
