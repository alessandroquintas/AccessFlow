import type { ActivityEntry, OrganizationSummary } from "../schemas";

const HOUR = 60 * 60 * 1000;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

/** Contagens de cada organização (por id), coerentes com as fixtures de convites e papéis. */
export const ORGANIZATION_SUMMARIES: Record<string, OrganizationSummary> = {
  "org-vale-verde": { pendingInvitations: 3, roles: 6, activeIntegrations: 2 },
  "org-atlantico": { pendingInvitations: 2, roles: 3, activeIntegrations: 1 },
};

/** Organização recém-criada (cenário "Vazio"). */
export const EMPTY_SUMMARY: OrganizationSummary = { pendingInvitations: 0, roles: 2, activeIntegrations: 0 };

/** As últimas ações da trilha de cada organização, da mais recente para a mais antiga. */
export const RECENT_ACTIVITY: Record<string, ActivityEntry[]> = {
  "org-vale-verde": [
    {
      id: "evt-1",
      kind: "member",
      actorName: "Sofia Campos",
      summary: "aceitou o convite e entrou com o papel Gestor de acesso",
      occurredAt: hoursAgo(2),
    },
    {
      id: "evt-2",
      kind: "invitation",
      actorName: "Camila Teixeira",
      summary: "convidou tiago.nunes@valeverde.coop.br com o papel Financeiro",
      occurredAt: hoursAgo(5),
    },
    {
      id: "evt-3",
      kind: "role",
      actorName: "Helena Duarte",
      summary: "trocou o papel de Bruno Cardoso para Auditoria",
      occurredAt: hoursAgo(20),
    },
    {
      id: "evt-4",
      kind: "permission",
      actorName: "Helena Duarte",
      summary: "concedeu ao papel Financeiro a permissão",
      permission: "faturas:aprovar",
      occurredAt: hoursAgo(28),
    },
    {
      id: "evt-5",
      kind: "invitation",
      actorName: "Helena Duarte",
      summary: "revogou o convite de paula.siqueira@valeverde.coop.br",
      occurredAt: hoursAgo(2 * 24 + 3),
    },
    {
      id: "evt-6",
      kind: "integration",
      actorName: "Helena Duarte",
      summary: "criou a integração ERP Financeiro",
      occurredAt: hoursAgo(5 * 24),
    },
    {
      id: "evt-7",
      kind: "member",
      actorName: "Helena Duarte",
      summary: "removeu Marcos Vilela da organização",
      occurredAt: hoursAgo(6 * 24 + 4),
    },
  ],
  "org-atlantico": [
    {
      id: "evt-a1",
      kind: "invitation",
      actorName: "Marina Albuquerque",
      summary: "convidou renata.queiroz@labatlantico.org.br com o papel Pesquisa",
      occurredAt: hoursAgo(6 * 24 + 4),
    },
    {
      id: "evt-a2",
      kind: "integration",
      actorName: "Helena Duarte",
      summary: "criou a integração LIMS Amostras",
      occurredAt: hoursAgo(9 * 24),
    },
    {
      id: "evt-a3",
      kind: "role",
      actorName: "Helena Duarte",
      summary: "criou o papel Pesquisa",
      occurredAt: hoursAgo(12 * 24),
    },
  ],
};
