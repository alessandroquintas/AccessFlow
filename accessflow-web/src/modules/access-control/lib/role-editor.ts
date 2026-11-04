import type { OrganizationRole, PermissionDefinition, PermissionKey } from "../schemas";

/**
 * Por que uma permissão não pode ser marcada nem desmarcada no editor:
 * - owner: o papel é o OWNER (tem todas, sempre);
 * - read-only: o viewer não tem roles:manage;
 * - escalation: o viewer não tem a permissão, então não pode concedê-la nem
 *   tirá-la (vale para as duas direções).
 * Só estado de tela: a API decide de novo (PRIVILEGE_ESCALATION).
 */
export type PermissionLock = "owner" | "read-only" | "escalation" | null;

export function permissionLock(
  key: PermissionKey,
  {
    roleKind,
    canManage,
    viewerPermissions,
  }: { roleKind: OrganizationRole["kind"]; canManage: boolean; viewerPermissions: readonly PermissionKey[] },
): PermissionLock {
  if (roleKind === "OWNER") return "owner";
  if (!canManage) return "read-only";
  return viewerPermissions.includes(key) ? null : "escalation";
}

/** O que muda ao salvar: as adicionadas e as removidas, na ordem de cada lista. */
export function diffPermissions(before: readonly PermissionKey[], after: readonly PermissionKey[]) {
  return {
    added: after.filter((key) => !before.includes(key)),
    removed: before.filter((key) => !after.includes(key)),
  };
}

/** "+2, −1"; "Sem mudanças" quando nada muda. */
export function formatDiff({ added, removed }: { added: readonly string[]; removed: readonly string[] }) {
  const parts = [added.length > 0 && `+${added.length}`, removed.length > 0 && `−${removed.length}`].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Sem mudanças";
}

/**
 * Marca ou desmarca todas as permissões do grupo que não estão travadas; as
 * travadas ficam como estão.
 */
export function toggleGroup(
  selected: readonly PermissionKey[],
  group: readonly PermissionKey[],
  isLocked: (key: PermissionKey) => boolean,
  on: boolean,
) {
  const free = group.filter((key) => !isLocked(key));
  const rest = selected.filter((key) => !free.includes(key));
  return on ? [...rest, ...free] : rest;
}

/** Os recursos de sistema, na ordem das telas; os personalizados vêm depois, por nome. */
const SYSTEM_RESOURCES = ["organizations", "members", "roles", "permissions", "integrations", "audit"];

export const resourceOf = (key: string) => key.slice(0, key.indexOf(":"));

export interface PermissionGroup {
  resource: string;
  system: boolean;
  permissions: PermissionDefinition[];
}

/** Agrupa o catálogo por recurso: os de sistema primeiro, depois os personalizados. */
export function groupByResource(catalog: readonly PermissionDefinition[]): PermissionGroup[] {
  const groups = new Map<string, PermissionDefinition[]>();
  for (const permission of catalog) {
    const resource = resourceOf(permission.key);
    groups.set(resource, [...(groups.get(resource) ?? []), permission]);
  }
  const system = SYSTEM_RESOURCES.filter((resource) => groups.has(resource));
  const custom = [...groups.keys()].filter((resource) => !SYSTEM_RESOURCES.includes(resource)).sort();
  return [...system, ...custom].map((resource) => ({
    resource,
    system: SYSTEM_RESOURCES.includes(resource),
    permissions: groups.get(resource) ?? [],
  }));
}
