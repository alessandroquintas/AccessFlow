"use client";

import { PermissionKeyTag } from "@/shared/components/permission-key-tag";
import { usePermissions } from "../hooks/use-permissions";

/** As permissões da persona atual na organização, como etiquetas. */
export function ViewerPermissions({ organizationId }: { organizationId: string }) {
  const { permissions } = usePermissions(organizationId);

  if (permissions.length === 0) {
    return <p className="text-sm text-muted-foreground">Esta persona não é membro da organização.</p>;
  }

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Permissões">
      {permissions.map((key) => (
        <li key={key}>
          <PermissionKeyTag value={key} />
        </li>
      ))}
    </ul>
  );
}
