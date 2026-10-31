"use client";

import { sessionStore } from "@/infra/mocks/personas";
import { useStore } from "@/infra/mocks/use-store";
import { VIEWER_PERMISSIONS } from "../fixtures/viewer-permissions";
import type { PermissionKey } from "../schemas";

const NO_PERMISSIONS: PermissionKey[] = [];

/** Permissões da persona atual na organização (equivale ao `myPermissions`). */
export function usePermissions(organizationId: string | undefined) {
  const { personaId } = useStore(sessionStore);
  const permissions =
    (organizationId && VIEWER_PERMISSIONS[personaId][organizationId]) || NO_PERMISSIONS;

  return {
    permissions,
    can: (key: PermissionKey) => permissions.includes(key),
    canAll: (keys: readonly PermissionKey[]) =>
      keys.every((key) => permissions.includes(key)),
  };
}
