"use client";

import { useScenario } from "@/infra/mocks/scenario";
import { NoPermissionState } from "@/shared/components/feedback/no-permission-state";
import { usePermissions } from "../hooks/use-permissions";
import type { PermissionKey } from "../schemas";

interface RequirePermissionProps {
  organizationId: string | undefined;
  permissions: readonly PermissionKey[];
  /** Onde o estado "sem permissão" entra, quando a página monta o próprio cabeçalho. */
  fallback?: (state: React.ReactNode) => React.ReactNode;
  children: React.ReactNode;
}

/**
 * Guard de página: quem chega pela URL sem permissão vê o estado "sem
 * permissão", nunca uma tela quebrada. O cenário "Sem permissão" do seletor
 * força esse estado.
 */
export function RequirePermission({ organizationId, permissions, fallback, children }: RequirePermissionProps) {
  const { canAll } = usePermissions(organizationId);
  const scenario = useScenario();
  if (canAll(permissions) && scenario !== "forbidden") return children;
  return fallback ? fallback(<NoPermissionState />) : <NoPermissionState />;
}
