"use client";

import { usePermissions } from "../hooks/use-permissions";
import type { PermissionKey } from "../schemas";

/** Para montar listas que dependem de várias permissões (ex.: os cartões da visão geral). */
export function PermissionCheck({
  organizationId,
  children,
}: {
  organizationId: string;
  children: (can: (key: PermissionKey) => boolean) => React.ReactNode;
}) {
  const { can } = usePermissions(organizationId);
  return children(can);
}
