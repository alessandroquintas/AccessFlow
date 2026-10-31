import type { PersonaId } from "@/infra/mocks/personas";
import type { PermissionKey } from "../schemas";
import { CUSTOM_PERMISSIONS, SYSTEM_PERMISSIONS } from "./permission-catalog";

const ALL = [...SYSTEM_PERMISSIONS, ...CUSTOM_PERMISSIONS].map(({ key }) => key);

/**
 * O que cada persona pode em cada organização (por id). Organização ausente
 * do mapa: a persona não é membro dela.
 */
export const VIEWER_PERMISSIONS: Record<PersonaId, Record<string, PermissionKey[]>> = {
  owner: {
    "org-vale-verde": ALL,
    "org-atlantico": SYSTEM_PERMISSIONS.map(({ key }) => key),
  },
  member: {
    "org-vale-verde": ["members:read"],
  },
  custom: {
    "org-vale-verde": [
      "members:read",
      "members:invite",
      "roles:read",
      "roles:assign",
      "audit:read",
      "integrations:read",
    ],
    "org-atlantico": ["members:read"],
  },
  "first-access": {},
};
