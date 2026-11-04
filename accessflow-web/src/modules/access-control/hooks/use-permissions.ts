"use client";

import { sessionStore } from "@/infra/mocks/personas";
import { useStore } from "@/infra/mocks/use-store";
import { VIEWER_PERMISSIONS } from "../fixtures/viewer-permissions";
import type { PermissionKey } from "../schemas";
import { useOrganizationCatalog } from "./use-organization-catalog";

const NO_PERMISSIONS: PermissionKey[] = [];

/** Permissões da persona atual na organização (equivale ao `myPermissions`). */
export function usePermissions(organizationId: string | undefined) {
  const { personaId } = useStore(sessionStore);
  const { allKeys } = useOrganizationCatalog(organizationId);
  const granted = organizationId ? VIEWER_PERMISSIONS[personaId][organizationId] : undefined;
  // O OWNER recebe o catálogo inteiro, como na API.
  const permissions = granted === "ALL" ? allKeys : (granted ?? NO_PERMISSIONS);

  return {
    permissions,
    can: (key: PermissionKey) => permissions.includes(key),
    canAll: (keys: readonly PermissionKey[]) => keys.every((key) => permissions.includes(key)),
  };
}
