import type { OrganizationInvitation } from "../schemas";

const HOUR = 60 * 60 * 1000;
const inHours = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();

const VV = {
  member: { id: "role-vv-member", name: "MEMBER", kind: "MEMBER" as const },
  audit: { id: "role-vv-audit", name: "Auditoria", kind: "CUSTOM" as const },
  finance: { id: "role-vv-finance", name: "Financeiro", kind: "CUSTOM" as const },
};

/**
 * Convites pendentes de cada organização (por id), vencidos incluídos, do
 * mais recente para o mais antigo (como o `organizationInvitations`). Os
 * pendentes batem com o resumo da visão geral.
 */
export const ORGANIZATION_INVITATIONS: Record<string, OrganizationInvitation[]> = {
  "org-vale-verde": [
    {
      id: "oinv-tiago",
      email: "tiago.nunes@valeverde.coop.br",
      assignedRole: VV.finance,
      invitedByName: "Camila Teixeira",
      expiresAt: inHours(30),
      status: "PENDING",
    },
    {
      id: "oinv-ana",
      email: "ana.lima@valeverde.coop.br",
      assignedRole: VV.member,
      invitedByName: "Helena Duarte",
      expiresAt: inHours(6 * 24),
      status: "PENDING",
    },
    {
      id: "oinv-lucia",
      email: "lucia.ferraz@parceiro.com.br",
      assignedRole: VV.audit,
      invitedByName: "Helena Duarte",
      expiresAt: inHours(4 * 24),
      status: "PENDING",
    },
    {
      id: "oinv-otavio",
      email: "otavio.reis@valeverde.coop.br",
      assignedRole: VV.member,
      invitedByName: "Camila Teixeira",
      expiresAt: inHours(-2 * 24),
      status: "EXPIRED",
    },
    {
      id: "oinv-debora",
      email: "debora.antunes@valeverde.coop.br",
      assignedRole: VV.member,
      invitedByName: "Camila Teixeira",
      expiresAt: inHours(-20 * 24),
      status: "EXPIRED",
    },
  ],
  "org-atlantico": [
    {
      id: "oinv-renata",
      email: "renata.queiroz@labatlantico.org.br",
      assignedRole: { id: "role-at-research", name: "Pesquisa", kind: "CUSTOM" },
      invitedByName: "Marina Albuquerque",
      expiresAt: inHours(20),
      status: "PENDING",
    },
    {
      id: "oinv-diego",
      email: "diego.prates@labatlantico.org.br",
      assignedRole: { id: "role-at-member", name: "MEMBER", kind: "MEMBER" },
      invitedByName: "Helena Duarte",
      expiresAt: inHours(5 * 24),
      status: "PENDING",
    },
  ],
};
