import { Role } from '../../domain/entities/role.entity';
import { RoleRepository } from '../../domain/repositories/role.repository';

/** Papéis dos ids informados numa consulta só, indexados por id. */
export async function rolesById(
  roles: RoleRepository,
  ids: string[],
): Promise<Map<string, Role>> {
  if (ids.length === 0) return new Map();

  const found = await roles.findByIds([...new Set(ids)]);
  return new Map(found.map((role) => [role.id, role]));
}
