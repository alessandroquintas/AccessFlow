import type { PersonaId } from "@/infra/mocks/personas";
import type { MyInvitation } from "../schemas";

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

export const MY_INVITATIONS: Record<PersonaId, MyInvitation[]> = {
  owner: [
    {
      id: "inv-ponte-alta",
      organization: { name: "Editora Ponte Alta", slug: "ponte-alta" },
      assignedRole: { name: "Revisão editorial", kind: "CUSTOM" },
      invitedByName: "Otávio Bragança",
      expiresAt: inDays(5),
    },
  ],
  member: [
    {
      id: "inv-atlantico",
      organization: { name: "Laboratório Atlântico", slug: "laboratorio-atlantico" },
      assignedRole: { name: "MEMBER", kind: "MEMBER" },
      invitedByName: "Helena Duarte",
      expiresAt: inDays(6),
    },
  ],
  custom: [],
  "first-access": [
    {
      id: "inv-vale-verde",
      organization: { name: "Cooperativa Vale Verde", slug: "vale-verde" },
      assignedRole: { name: "Auditoria", kind: "CUSTOM" },
      invitedByName: "Helena Duarte",
      expiresAt: inDays(5),
    },
    {
      id: "inv-atlantico-owner",
      organization: { name: "Laboratório Atlântico", slug: "laboratorio-atlantico" },
      assignedRole: { name: "OWNER", kind: "OWNER" },
      invitedByName: "Helena Duarte",
      expiresAt: inDays(1),
    },
  ],
};
