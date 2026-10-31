"use client";

import { NoPermissionState } from "@/shared/components/feedback/no-permission-state";
import { usePermissions } from "../hooks/use-permissions";
import type { PermissionKey } from "../schemas";

interface RequirePermissionProps {
  organizationId: string | undefined;
  permissions: readonly PermissionKey[];
  children: React.ReactNode;
}

/**
 * Guard de página: quem chega pela URL sem permissão vê o estado "sem
 * permissão", nunca uma tela quebrada.
 */
export function RequirePermission({ organizationId, permissions, children }: RequirePermissionProps) {
  const { canAll } = usePermissions(organizationId);
  return canAll(permissions) ? children : <NoPermissionState />;
}
