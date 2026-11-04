import type { AuditAction, AuditActor, AuditDirectory, AuditEvent, Decision, SecurityEventType } from "../schemas";

/** Um trecho do texto: comum, em destaque (um nome) ou uma chave de permissão (vira tag). */
export type Segment = string | { strong: string } | { permission: string };

/** Uma linha dos detalhes expansíveis: legível, nunca JSON cru. */
export type DetailItem =
  | { kind: "change"; label: string; from: string; to: string }
  | { kind: "text"; label: string; value: string }
  | { kind: "permissions"; label: string; keys: string[]; sign?: "+" | "−" }
  | { kind: "scopes"; label: string; scopes: string[] }
  | { kind: "mono"; label: string; value: string };

export interface Description {
  summary: Segment[];
  details: DetailItem[];
}

/** O texto puro (para leitores de tela, testes e a busca). */
export const plainText = (segments: Segment[]) =>
  segments
    .map((segment) =>
      typeof segment === "string" ? segment : "strong" in segment ? segment.strong : segment.permission,
    )
    .join("");

/** Rótulos curtos para o filtro de ação, agrupados como na tela. */
export const ACTION_LABELS: Record<AuditAction, string> = {
  "organization.created": "Organização criada",
  "organization.updated": "Organização renomeada",
  "member.removed": "Membro removido",
  "member.left": "Membro saiu",
  "member.role_changed": "Papel de membro trocado",
  "invitation.created": "Convite enviado",
  "invitation.renewed": "Convite renovado",
  "invitation.revoked": "Convite revogado",
  "invitation.accepted": "Convite aceito",
  "invitation.declined": "Convite recusado",
  "role.created": "Papel criado",
  "role.updated": "Papel editado",
  "role.deleted": "Papel excluído",
  "permission.created": "Permissão criada",
  "permission.updated": "Permissão editada",
  "permission.deleted": "Permissão excluída",
  "integration.created": "Integração criada",
  "integration.revoked": "Integração revogada",
};

/** Quem fez: o nome atual, a integração ou o sistema. */
export function actorLabel(actor: AuditActor, directory: AuditDirectory) {
  if (actor.type === "SYSTEM") return "Sistema";
  if (actor.type === "MACHINE") {
    return (actor.clientId && directory.integrations[actor.clientId]) ?? "Integração";
  }
  return actor.name ?? "Usuário sem perfil";
}

/**
 * O texto humano de cada uma das 18 ações e os detalhes legíveis. Ids viram
 * nomes pelo diretório; o que ele não conhece (ex-membro, papel excluído)
 * cai num texto genérico, como a API permite.
 */
export function describeAuditEvent({ action, target, details }: AuditEvent, directory: AuditDirectory): Description {
  const role = (id?: string) => ({ strong: (id && directory.roles[id]) ?? "um papel excluído" });
  const member = (id: string) => ({ strong: directory.members[id] ?? "um ex-membro" });
  const integration = () => ({
    strong: details.name ?? directory.integrations[target.id] ?? (details.clientId && directory.integrations[details.clientId]) ?? "uma integração",
  });

  switch (action) {
    case "organization.created":
      return {
        summary: ["criou a organização ", { strong: details.name ?? "" }],
        details: details.slug ? [{ kind: "mono", label: "Identificador", value: details.slug }] : [],
      };
    case "organization.updated": {
      const name = details.changes?.name;
      return {
        summary: ["renomeou a organização", ...(name ? [" para ", { strong: name.to }] : [])],
        details: name ? [{ kind: "change", label: "Nome", from: name.from, to: name.to }] : [],
      };
    }
    case "member.removed":
      return {
        summary: ["removeu ", member(target.id), " da organização"],
        details: [{ kind: "text", label: "Papel que tinha", value: role(details.roleId).strong }],
      };
    case "member.left":
      return {
        summary: ["saiu da organização"],
        details: [{ kind: "text", label: "Papel que tinha", value: role(details.roleId).strong }],
      };
    case "member.role_changed":
      return {
        summary: ["trocou o papel de ", member(target.id), " de ", role(details.fromRoleId), " para ", role(details.toRoleId)],
        details: [{ kind: "change", label: "Papel", from: role(details.fromRoleId).strong, to: role(details.toRoleId).strong }],
      };
    case "invitation.created":
      return { summary: ["convidou uma pessoa com o papel ", role(details.roleId)], details: [] };
    case "invitation.renewed":
      return details.previousRoleId
        ? {
            summary: ["renovou um convite e trocou o papel para ", role(details.roleId)],
            details: [{ kind: "change", label: "Papel do convite", from: role(details.previousRoleId).strong, to: role(details.roleId).strong }],
          }
        : { summary: ["renovou por mais 7 dias um convite com o papel ", role(details.roleId)], details: [] };
    case "invitation.revoked":
      return { summary: ["revogou um convite pendente"], details: [] };
    case "invitation.accepted":
      return {
        summary:
          details.membership === "reactivated"
            ? ["aceitou o convite e voltou à organização com o papel ", role(details.roleId)]
            : ["aceitou o convite e entrou com o papel ", role(details.roleId)],
        details: [],
      };
    case "invitation.declined":
      return { summary: ["recusou um convite"], details: [] };
    case "role.created":
      return {
        summary: ["criou o papel ", { strong: details.name ?? "" }],
        details: [{ kind: "permissions", label: "Permissões", keys: details.permissions ?? [] }],
      };
    case "role.updated": {
      const changes = details.changes ?? {};
      const items: DetailItem[] = [];
      if (changes.name) items.push({ kind: "change", label: "Nome", from: changes.name.from, to: changes.name.to });
      if (changes.permissionsAdded?.length) {
        items.push({ kind: "permissions", label: "Adicionadas", keys: changes.permissionsAdded, sign: "+" });
      }
      if (changes.permissionsRemoved?.length) {
        items.push({ kind: "permissions", label: "Removidas", keys: changes.permissionsRemoved, sign: "−" });
      }
      const counts = [
        changes.permissionsAdded?.length && `+${changes.permissionsAdded.length}`,
        changes.permissionsRemoved?.length && `−${changes.permissionsRemoved.length}`,
      ].filter(Boolean);
      return {
        summary: [
          "editou o papel ",
          changes.name ? { strong: changes.name.to } : role(target.id),
          ...(counts.length > 0 ? [` (${counts.join(", ")} permissões)`] : []),
        ],
        details: items,
      };
    }
    case "role.deleted":
      return { summary: ["excluiu o papel ", { strong: details.name ?? "" }], details: [] };
    case "permission.created":
      return {
        summary: ["criou a permissão ", { permission: details.key ?? target.id }],
        details: details.description ? [{ kind: "text", label: "Descrição", value: details.description }] : [],
      };
    case "permission.updated": {
      const description = details.changes?.description;
      return {
        summary: ["mudou a descrição da permissão ", { permission: target.id }],
        details: description ? [{ kind: "change", label: "Descrição", from: description.from, to: description.to }] : [],
      };
    }
    case "permission.deleted":
      return { summary: ["excluiu a permissão ", { permission: details.key ?? target.id }], details: [] };
    case "integration.created":
      return {
        summary: ["criou a integração ", integration()],
        details: [{ kind: "scopes", label: "Escopos", scopes: details.scopes ?? [] }],
      };
    case "integration.revoked":
      return {
        summary: ["revogou a integração ", integration()],
        details: details.clientId ? [{ kind: "mono", label: "client_id", value: details.clientId }] : [],
      };
  }
}

export const SECURITY_EVENT_LABELS: Record<SecurityEventType, string> = {
  "access.forbidden": "Acesso negado por falta de permissão",
  "access.privilege_escalation": "Tentativa de escalada de privilégio",
  "machine.scope_denied": "Integração sem o escopo exigido",
  "machine.organization_denied": "Integração fora do vínculo com a organização",
};

export type DecisionOutcome = "allowed" | "denied" | "partial";

/** Permitido: todas; Negado: nenhuma; Parcial: algumas. */
export const decisionOutcome = ({ results }: Decision): DecisionOutcome => {
  const allowed = results.filter((result) => result.allowed).length;
  return allowed === results.length ? "allowed" : allowed === 0 ? "denied" : "partial";
};

/**
 * Filtro de resultado: o mesmo `allowed` da API (AuthorizationDecisionFilter).
 * O parcial entra em "Negado": separá-lo no cliente quebraria a paginação.
 */
export type AllowedFilter = "allowed" | "denied";

export const ALLOWED_FILTER_LABELS: Record<AllowedFilter, string> = { allowed: "Permitido", denied: "Negado" };

export const matchesAllowed = (decision: Decision, filter: AllowedFilter | null) =>
  filter === null || decision.allowed === (filter === "allowed");

export const OUTCOME_LABELS: Record<DecisionOutcome, string> = {
  allowed: "Permitido",
  denied: "Negado",
  partial: "Parcial",
};
