"use client";

import { useScenario } from "@/infra/mocks/scenario";
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
 * permissão", nunca uma tela quebrada. O cenário "Sem permissão" do seletor
 * força esse estado.
 */
export function RequirePermission({ organizationId, permissions, children }: RequirePermissionProps) {
  const { canAll } = usePermissions(organizationId);
  const scenario = useScenario();
  return canAll(permissions) && scenario !== "forbidden" ? children : <NoPermissionState />;
}
