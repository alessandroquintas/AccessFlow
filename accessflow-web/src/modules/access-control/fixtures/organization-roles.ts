import type { OrganizationRole } from "../schemas";
import { CUSTOM_PERMISSIONS, SYSTEM_PERMISSIONS } from "./permission-catalog";

const SYSTEM = SYSTEM_PERMISSIONS.map(({ key }) => key);
const ALL = [...SYSTEM, ...CUSTOM_PERMISSIONS.map(({ key }) => key)];

/** Papéis de cada organização (por id): os de sistema primeiro, depois por nome. */
export const ORGANIZATION_ROLES: Record<string, OrganizationRole[]> = {
  "org-vale-verde": [
    { id: "role-vv-owner", name: "OWNER", kind: "OWNER", permissions: ALL },
    { id: "role-vv-member", name: "MEMBER", kind: "MEMBER", permissions: ["members:read"] },
    {
      id: "role-vv-admin",
      name: "Administração",
      kind: "CUSTOM",
      permissions: SYSTEM.filter((key) => key !== "organizations:update"),
    },
    { id: "role-vv-audit", name: "Auditoria", kind: "CUSTOM", permissions: ["members:read", "audit:read"] },
    {
      id: "role-vv-finance",
      name: "Financeiro",
      kind: "CUSTOM",
      permissions: ["members:read", "faturas:aprovar", "relatorios:exportar"],
    },
    {
      id: "role-vv-access",
      name: "Gestor de acesso",
      kind: "CUSTOM",
      permissions: ["members:read", "members:invite", "roles:read", "roles:assign", "audit:read", "integrations:read"],
    },
  ],
  "org-atlantico": [
    { id: "role-at-owner", name: "OWNER", kind: "OWNER", permissions: SYSTEM },
    { id: "role-at-member", name: "MEMBER", kind: "MEMBER", permissions: ["members:read"] },
    { id: "role-at-research", name: "Pesquisa", kind: "CUSTOM", permissions: ["members:read", "roles:read"] },
  ],
};
