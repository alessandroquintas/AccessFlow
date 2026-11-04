"use client";

import { type GrantBlock, useOrganizationRoles } from "../hooks/use-organization-roles";
import type { OrganizationRole, PermissionKey } from "../schemas";

/** A explicação de um papel bloqueado, na linguagem da /design. */
export const GRANT_BLOCK_TEXT: Record<Exclude<GrantBlock, null>, string> = {
  "owner-only": "Só um OWNER pode tornar alguém OWNER.",
  "missing-permissions": "Tem permissões que você não tem, então você não pode concedê-lo.",
};

interface OrganizationRolesProps {
  organizationId: string;
  viewerIsOwner: boolean;
  children: (value: {
    roles: OrganizationRole[];
    grantBlock: (role: OrganizationRole) => GrantBlock;
    /** O viewer tem a permissão na organização? */
    can: (key: PermissionKey) => boolean;
  }) => React.ReactNode;
}

/** Entrega os papéis, a regra de concessão e as permissões do viewer para quem está fora do módulo. */
export function OrganizationRoles({ organizationId, viewerIsOwner, children }: OrganizationRolesProps) {
  return children(useOrganizationRoles(organizationId, viewerIsOwner));
}
