import { Role } from '../../domain/entities/role.entity';
import { RoleNameTakenError } from '../../domain/errors/role-name-taken.error';

/**
 * RoleNameTakenError se outro papel não apagado da organização tiver o mesmo
 * nome, sem diferenciar a caixa (os de sistema contam). O próprio papel não
 * conta: renomear "gerente" para "Gerente" é aceito. Só vale dentro da
 * transação, com a organização travada.
 */
export function ensureRoleNameAvailable(
  activeRoles: readonly Role[],
  role: Role,
): void {
  const taken = activeRoles.some(
    (other) => other.id !== role.id && other.hasSameNameAs(role),
  );
  if (taken) throw new RoleNameTakenError();
}
