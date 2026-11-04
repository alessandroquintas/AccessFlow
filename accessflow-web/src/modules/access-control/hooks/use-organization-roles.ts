"use client";

import { useStore } from "@/infra/mocks/use-store";
import { ORGANIZATION_ROLES } from "../fixtures/organization-roles";
import type { OrganizationRole } from "../schemas";
import { catalogStore } from "./catalog-store";
import { useOrganizationCatalog } from "./use-organization-catalog";
import { usePermissions } from "./use-permissions";

const NO_ROLES: OrganizationRole[] = [];

export type GrantBlock = "owner-only" | "missing-permissions" | null;

const KIND_ORDER = { OWNER: 0, MEMBER: 1, CUSTOM: 2 };

/** Os de sistema primeiro, depois os personalizados por nome (como o `organizationRoles`). */
const byApiOrder = (a: OrganizationRole, b: OrganizationRole) =>
  KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name, "pt-BR");

/**
 * Papéis da organização (equivale ao `organizationRoles`) e o que o viewer
 * pode conceder. Só estado de tela: a API decide de novo (PRIVILEGE_ESCALATION).
 */
export function useOrganizationRoles(organizationId: string, viewerIsOwner: boolean) {
  const { permissions, can } = usePermissions(organizationId);
  const { allKeys, limits } = useOrganizationCatalog(organizationId);
  const changes = useStore(catalogStore);
  const stored = changes.roles[organizationId] ?? ORGANIZATION_ROLES[organizationId] ?? NO_ROLES;
  // O OWNER tem o catálogo inteiro; as listas dos outros seguem a ordem do catálogo.
  const roles = stored
    .map((role) => ({
      ...role,
      permissions:
        role.kind === "OWNER" ? allKeys : allKeys.filter((key) => role.permissions.includes(key)),
    }))
    .toSorted(byApiOrder);

  /** Por que o viewer não pode conceder (nem tirar) o papel; null quando pode. */
  const grantBlock = (role: OrganizationRole): GrantBlock => {
    if (role.kind === "OWNER") return viewerIsOwner ? null : "owner-only";
    return role.permissions.every((key) => permissions.includes(key)) ? null : "missing-permissions";
  };

  const setRoles = (next: (current: OrganizationRole[]) => OrganizationRole[]) =>
    catalogStore.set((all) => ({
      ...all,
      roles: { ...all.roles, [organizationId]: next(all.roles[organizationId] ?? stored) },
    }));

  return {
    roles,
    grantBlock,
    can,
    customRoleCount: roles.filter(({ kind }) => kind === "CUSTOM").length,
    customRoleLimit: limits.customRoles,
    /** Quantos papéis concedem a permissão (o OWNER, que tem todas, não conta). */
    rolesUsing: (key: string) => roles.filter((role) => role.kind !== "OWNER" && role.permissions.includes(key)).length,
    saveRole: (role: OrganizationRole) =>
      setRoles((current) =>
        current.some(({ id }) => id === role.id)
          ? current.map((item) => (item.id === role.id ? role : item))
          : [...current, role],
      ),
    deleteRole: (id: string) => setRoles((current) => current.filter((role) => role.id !== id)),
  };
}
