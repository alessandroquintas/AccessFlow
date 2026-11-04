import type { PersonaId } from "@/infra/mocks/personas";
import type { Member, MemberRole } from "../schemas";

const VV: Record<string, MemberRole> = {
  owner: { id: "role-vv-owner", name: "OWNER", kind: "OWNER" },
  member: { id: "role-vv-member", name: "MEMBER", kind: "MEMBER" },
  admin: { id: "role-vv-admin", name: "Administração", kind: "CUSTOM" },
  audit: { id: "role-vv-audit", name: "Auditoria", kind: "CUSTOM" },
  finance: { id: "role-vv-finance", name: "Financeiro", kind: "CUSTOM" },
  access: { id: "role-vv-access", name: "Gestor de acesso", kind: "CUSTOM" },
};

const AT: Record<string, MemberRole> = {
  owner: { id: "role-at-owner", name: "OWNER", kind: "OWNER" },
  member: { id: "role-at-member", name: "MEMBER", kind: "MEMBER" },
  research: { id: "role-at-research", name: "Pesquisa", kind: "CUSTOM" },
};

/** "Lúcia Ferraz" → "lucia.ferraz". */
const localPart = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(" ")
    .join(".");

type Row = [userId: string, name: string, role: MemberRole, joinedAt: string];

const build = (rows: Row[], domain: string): Member[] =>
  rows.map(([userId, name, role, joinedAt]) => ({
    userId,
    name,
    email: `${localPart(name)}@${domain}`,
    role,
    joinedAt: `${joinedAt}T13:00:00.000Z`,
  }));

/** Membros ativos de cada organização (por id), do mais antigo para o mais recente. */
export const MEMBERS: Record<string, Member[]> = {
  // Helena é a única OWNER: estado de "último OWNER".
  "org-vale-verde": build(
    [
      ["u-helena", "Helena Duarte", VV.owner, "2025-09-15"],
      ["u-gustavo", "Gustavo Amaral", VV.admin, "2025-09-18"],
      ["u-marta", "Marta Lacerda", VV.finance, "2025-09-22"],
      ["u-eduardo", "Eduardo Pires", VV.member, "2025-10-01"],
      ["u-leticia", "Letícia Fontes", VV.member, "2025-10-03"],
      ["u-roberto", "Roberto Saldanha", VV.finance, "2025-10-14"],
      ["u-aline", "Aline Barros", VV.member, "2025-10-20"],
      ["u-fabio", "Fábio Guimarães", VV.member, "2025-11-04"],
      ["u-isabela", "Isabela Rocha", VV.audit, "2025-11-11"],
      ["u-joao", "João Batista Neves", VV.member, "2025-11-19"],
      ["u-patricia", "Patrícia Moura", VV.member, "2025-12-02"],
      ["u-rafael", "Rafael Moreira", VV.member, "2026-01-04"],
      ["u-vinicius", "Vinícius Tavares", VV.member, "2026-01-09"],
      ["u-camila", "Camila Teixeira", VV.access, "2026-01-22"],
      ["u-beatriz", "Beatriz Quintela", VV.member, "2026-01-28"],
      ["u-bruno", "Bruno Cardoso", VV.audit, "2026-02-10"],
      ["u-carolina", "Carolina Peixoto", VV.member, "2026-02-17"],
      ["u-daniel", "Daniel Azevedo", VV.finance, "2026-03-02"],
      ["u-elisa", "Elisa Mendonça", VV.member, "2026-03-09"],
      ["u-felipe", "Felipe Brandão", VV.member, "2026-03-16"],
      ["u-giovana", "Giovana Lins", VV.member, "2026-03-30"],
      ["u-henrique", "Henrique Coutinho", VV.admin, "2026-04-06"],
      ["u-ingrid", "Ingrid Sales", VV.member, "2026-04-20"],
      ["u-julia", "Júlia Bastos", VV.member, "2026-05-04"],
      ["u-kleber", "Kléber Antunes", VV.member, "2026-05-11"],
      ["u-larissa", "Larissa Viana", VV.audit, "2026-05-25"],
      ["u-mauricio", "Maurício Prado", VV.member, "2026-06-08"],
      ["u-natalia", "Natália Falcão", VV.member, "2026-06-15"],
      ["u-otavio", "Otávio Rezende", VV.member, "2026-06-29"],
      ["u-priscila", "Priscila Carvalho", VV.finance, "2026-07-13"],
      ["u-renan", "Renan Siqueira", VV.member, "2026-07-27"],
      ["u-sabrina", "Sabrina Mattos", VV.member, "2026-08-10"],
      ["u-thiago", "Thiago Ventura", VV.member, "2026-08-24"],
      ["u-ursula", "Úrsula Diniz", VV.member, "2026-09-07"],
      ["u-valter", "Valter Gouveia", VV.member, "2026-09-21"],
      ["u-wesley", "Wesley Cabral", VV.member, "2026-10-05"],
      ["u-sofia", "Sofia Campos", VV.access, "2026-10-29"],
    ],
    "valeverde.coop.br",
  ),
  // Duas OWNERs: Helena pode sair e trocar o próprio papel.
  "org-atlantico": build(
    [
      ["u-helena", "Helena Duarte", AT.owner, "2026-04-13"],
      ["u-marina", "Marina Albuquerque", AT.owner, "2026-04-13"],
      ["u-caio", "Caio Furtado", AT.research, "2026-04-20"],
      ["u-denise", "Denise Arruda", AT.research, "2026-04-27"],
      ["u-camila", "Camila Teixeira", AT.member, "2026-05-06"],
      ["u-heitor", "Heitor Bezerra", AT.member, "2026-05-18"],
      ["u-luana", "Luana Paiva", AT.research, "2026-06-01"],
      ["u-murilo", "Murilo Castilho", AT.member, "2026-06-22"],
      ["u-nina", "Nina Valadares", AT.member, "2026-07-14"],
      ["u-pedro", "Pedro Henrique Lobo", AT.member, "2026-08-31"],
      ["u-tereza", "Tereza Morais", AT.research, "2026-10-12"],
    ],
    "labatlantico.org.br",
  ),
};

/** Quem é a persona na lista de membros (a linha marcada com "você"). */
export const VIEWER_USER_IDS: Record<PersonaId, string | null> = {
  owner: "u-helena",
  member: "u-rafael",
  custom: "u-camila",
  "first-access": null,
};
