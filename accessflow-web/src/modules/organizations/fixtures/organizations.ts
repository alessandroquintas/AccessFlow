import type { PersonaId } from "@/infra/mocks/personas";
import type { Organization, ViewerRole } from "../schemas";

const VALE_VERDE = {
  id: "org-vale-verde",
  name: "Cooperativa Vale Verde",
  slug: "vale-verde",
  createdAt: "2025-09-15T13:00:00.000Z",
  memberCount: 37,
};

const ATLANTICO = {
  id: "org-atlantico",
  name: "Laboratório Atlântico",
  slug: "laboratorio-atlantico",
  createdAt: "2026-04-13T13:00:00.000Z",
  memberCount: 11,
};

const OWNER: ViewerRole = { name: "OWNER", kind: "OWNER" };
const MEMBER: ViewerRole = { name: "MEMBER", kind: "MEMBER" };

/** Organizações de cada persona (equivale ao `myOrganizations`). */
export const MY_ORGANIZATIONS: Record<PersonaId, Organization[]> = {
  owner: [
    { ...VALE_VERDE, viewerRole: OWNER },
    { ...ATLANTICO, viewerRole: OWNER },
  ],
  member: [{ ...VALE_VERDE, viewerRole: MEMBER }],
  custom: [
    { ...VALE_VERDE, viewerRole: { name: "Gestor de acesso", kind: "CUSTOM" } },
    { ...ATLANTICO, viewerRole: MEMBER },
  ],
  "first-access": [],
};
