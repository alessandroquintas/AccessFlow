import { Role } from '../domain/entities/role.entity';
import { PrivilegeEscalationError } from '../domain/errors/privilege-escalation.error';

/*
 * Anti-escalada de privilégio: quem age só concede, retira ou atribui
 * permissões que tem. P(viewer) é o que o papel de quem age concede
 * (Role.grants): o OWNER tem todas, inclusive as que ainda não existem no
 * catálogo. Por isso o papel OWNER, como alvo, só é coberto por outro
 * OWNER. Toda violação lança PrivilegeEscalationError, com a organização do
 * papel de quem age.
 */

/** createRole: as permissões do papel novo ⊆ P(viewer). */
export function ensureCanCreateRole(
  viewer: Role,
  permissions: readonly string[],
): void {
  ensureGrantsAll(viewer, permissions);
}

/**
 * updateRole: (adicionadas ∪ removidas) ⊆ P(viewer). Quem não tem uma
 * permissão também não a tira de um papel.
 */
export function ensureCanChangePermissions(
  viewer: Role,
  change: { before: readonly string[]; after: readonly string[] },
): void {
  const before = new Set(change.before);
  const after = new Set(change.after);

  ensureGrantsAll(viewer, [
    ...[...after].filter((permission) => !before.has(permission)),
    ...[...before].filter((permission) => !after.has(permission)),
  ]);
}

/** assignRole: P(viewer) cobre o papel atual do alvo e o novo. */
export function ensureCanAssignRole(
  viewer: Role,
  change: { from: Role; to: Role },
): void {
  ensureCovers(viewer, change.from);
  ensureCovers(viewer, change.to);
}

/** inviteMember: P(viewer) cobre o papel com que o convidado entra. */
export function ensureCanInviteWithRole(viewer: Role, role: Role): void {
  ensureCovers(viewer, role);
}

function ensureCovers(viewer: Role, role: Role): void {
  // As permissões do OWNER não são uma lista: só outro OWNER tem todas.
  if (role.isOwner() && !viewer.isOwner()) {
    throw new PrivilegeEscalationError(viewer.organizationId);
  }
  ensureGrantsAll(viewer, role.permissions);
}

function ensureGrantsAll(viewer: Role, permissions: Iterable<string>): void {
  for (const permission of permissions) {
    if (!viewer.grants(permission)) {
      throw new PrivilegeEscalationError(viewer.organizationId);
    }
  }
}
