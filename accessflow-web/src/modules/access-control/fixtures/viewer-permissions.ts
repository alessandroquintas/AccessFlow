import type { PersonaId } from "@/infra/mocks/personas";
import type { PermissionKey } from "../schemas";

/**
 * O que cada persona pode em cada organização (por id). "ALL": OWNER, com o
 * catálogo inteiro da organização (inclusive as personalizadas criadas na
 * sessão). Organização ausente do mapa: a persona não é membro dela.
 */
export const VIEWER_PERMISSIONS: Record<PersonaId, Record<string, PermissionKey[] | "ALL">> = {
  owner: {
    "org-vale-verde": "ALL",
    "org-atlantico": "ALL",
  },
  member: {
    "org-vale-verde": ["members:read"],
  },
  // O papel "Gestor de acesso" (ver organization-roles.ts).
  custom: {
    "org-vale-verde": [
      "members:read",
      "members:invite",
      "roles:read",
      "roles:manage",
      "roles:assign",
      "audit:read",
      "integrations:read",
    ],
    "org-atlantico": ["members:read"],
  },
  "first-access": {},
};
