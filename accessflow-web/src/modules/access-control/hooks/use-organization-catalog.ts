"use client";

import { useStore } from "@/infra/mocks/use-store";
import { CUSTOM_PERMISSIONS, DESIGN_LIMITS, SYSTEM_PERMISSIONS } from "../fixtures/permission-catalog";
import { MAX_CUSTOM_PERMISSIONS, MAX_CUSTOM_ROLES, type PermissionDefinition } from "../schemas";
import { catalogStore } from "./catalog-store";

const NONE: PermissionDefinition[] = [];

/**
 * Catálogo efetivo da organização (equivale ao `organizationPermissions`):
 * as de sistema na ordem do catálogo, depois as personalizadas por chave.
 */
export function useOrganizationCatalog(organizationId: string | undefined) {
  const changes = useStore(catalogStore);
  const custom = organizationId
    ? (changes.permissions[organizationId] ?? CUSTOM_PERMISSIONS[organizationId] ?? NONE)
    : NONE;
  const limits = (organizationId && DESIGN_LIMITS[organizationId]) || {
    customRoles: MAX_CUSTOM_ROLES,
    customPermissions: MAX_CUSTOM_PERMISSIONS,
  };

  const setCustom = (next: (current: PermissionDefinition[]) => PermissionDefinition[]) => {
    if (!organizationId) return;
    catalogStore.set((all) => ({
      ...all,
      permissions: {
        ...all.permissions,
        [organizationId]: next(all.permissions[organizationId] ?? custom).toSorted((a, b) => a.key.localeCompare(b.key)),
      },
    }));
  };

  return {
    system: SYSTEM_PERMISSIONS,
    custom,
    allKeys: [...SYSTEM_PERMISSIONS, ...custom].map(({ key }) => key),
    limits,
    createPermission: (permission: PermissionDefinition) => setCustom((current) => [...current, permission]),
    updateDescription: (key: string, description: string) =>
      setCustom((current) => current.map((item) => (item.key === key ? { ...item, description } : item))),
    deletePermission: (key: string) => setCustom((current) => current.filter((item) => item.key !== key)),
  };
}
