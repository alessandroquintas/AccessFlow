import type { OrganizationRole } from "../schemas";
import { SYSTEM_PERMISSIONS } from "./permission-catalog";

const SYSTEM = SYSTEM_PERMISSIONS.map(({ key }) => key);

/**
 * Papéis de cada organização (por id). As contagens batem com as fixtures de
 * membros e de convites. O OWNER fica sem lista: o hook resolve para o
 * catálogo inteiro, inclusive as personalizadas criadas depois.
 */
export const ORGANIZATION_ROLES: Record<string, OrganizationRole[]> = {
  "org-vale-verde": [
    { id: "role-vv-owner", name: "OWNER", kind: "OWNER", permissions: [], memberCount: 1, pendingInvitationCount: 0 },
    {
      id: "role-vv-member",
      name: "MEMBER",
      kind: "MEMBER",
      permissions: ["members:read"],
      memberCount: 25,
      pendingInvitationCount: 3,
    },
    {
      id: "role-vv-admin",
      name: "Administração",
      kind: "CUSTOM",
      permissions: SYSTEM.filter((key) => key !== "organizations:update"),
      memberCount: 2,
      pendingInvitationCount: 0,
    },
    {
      id: "role-vv-audit",
      name: "Auditoria",
      kind: "CUSTOM",
      permissions: ["members:read", "audit:read"],
      memberCount: 3,
      pendingInvitationCount: 1,
    },
    {
      id: "role-vv-stock",
      name: "Estoque",
      kind: "CUSTOM",
      permissions: ["members:read", "estoque:ajustar", "estoque:consultar"],
      memberCount: 0,
      pendingInvitationCount: 0,
    },
    {
      id: "role-vv-finance",
      name: "Financeiro",
      kind: "CUSTOM",
      permissions: ["members:read", "faturas:aprovar", "relatorios:exportar"],
      memberCount: 4,
      pendingInvitationCount: 1,
    },
    {
      id: "role-vv-access",
      name: "Gestor de acesso",
      kind: "CUSTOM",
      permissions: [
        "members:read",
        "members:invite",
        "roles:read",
        "roles:manage",
        "roles:assign",
        "audit:read",
        "integrations:read",
      ],
      memberCount: 2,
      pendingInvitationCount: 0,
    },
  ],
  "org-atlantico": [
    { id: "role-at-owner", name: "OWNER", kind: "OWNER", permissions: [], memberCount: 2, pendingInvitationCount: 0 },
    {
      id: "role-at-member",
      name: "MEMBER",
      kind: "MEMBER",
      permissions: ["members:read"],
      memberCount: 5,
      pendingInvitationCount: 1,
    },
    {
      id: "role-at-research",
      name: "Pesquisa",
      kind: "CUSTOM",
      permissions: ["members:read", "roles:read", "amostras:liberar"],
      memberCount: 4,
      pendingInvitationCount: 1,
    },
  ],
};
