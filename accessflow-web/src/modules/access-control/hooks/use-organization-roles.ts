"use client";

import { ORGANIZATION_ROLES } from "../fixtures/organization-roles";
import type { OrganizationRole } from "../schemas";
import { usePermissions } from "./use-permissions";

const NO_ROLES: OrganizationRole[] = [];

export type GrantBlock = "owner-only" | "missing-permissions" | null;

/**
 * Papéis da organização (equivale ao `organizationRoles`) e o que o viewer
 * pode conceder. Só estado de tela: a API decide de novo (PRIVILEGE_ESCALATION).
 */
export function useOrganizationRoles(organizationId: string, viewerIsOwner: boolean) {
  const { permissions, can } = usePermissions(organizationId);
  const roles = ORGANIZATION_ROLES[organizationId] ?? NO_ROLES;

  /** Por que o viewer não pode conceder (nem tirar) o papel; null quando pode. */
  const grantBlock = (role: OrganizationRole): GrantBlock => {
    if (role.kind === "OWNER") return viewerIsOwner ? null : "owner-only";
    return role.permissions.every((key) => permissions.includes(key)) ? null : "missing-permissions";
  };

  return { roles, grantBlock, can };
}
