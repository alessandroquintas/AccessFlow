"use client";

import { usePermissions } from "../hooks/use-permissions";
import type { PermissionKey } from "../schemas";

interface CanProps {
  organizationId: string | undefined;
  /** Exige todas estas permissões. */
  permissions: readonly PermissionKey[];
  /** Exibido quando falta permissão (padrão: nada, a ação não aparece). */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/** Esconde ações e itens de menu sem permissão. */
export function Can({ organizationId, permissions, fallback = null, children }: CanProps) {
  const { canAll } = usePermissions(organizationId);
  return canAll(permissions) ? children : fallback;
}
