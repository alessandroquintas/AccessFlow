import { describe, expect, it } from "vitest";
import { AUDIT_DIRECTORY, AUDIT_EVENTS } from "../fixtures/audit";
import { AUDIT_ACTIONS, type AuditEvent } from "../schemas";
import { decisionOutcome, describeAuditEvent, matchesAllowed, plainText } from "./describe";

const directory = AUDIT_DIRECTORY["org-vale-verde"];
const HELENA = { type: "USER" as const, userId: "u-helena", name: "Helena Duarte", clientId: null };

const event = (action: AuditEvent["action"], target: AuditEvent["target"], details: AuditEvent["details"]): AuditEvent => ({
  id: action,
  action,
  actor: HELENA,
  target,
  details,
  occurredAt: "2026-11-01T12:00:00.000Z",
  requestId: null,
});

/** Um caso por ação, com o texto esperado depois do nome de quem fez. */
const CASES: [AuditEvent, string][] = [
  [event("organization.created", { type: "organization", id: "org" }, { name: "Cooperativa Vale Verde", slug: "vale-verde" }), "criou a organização Cooperativa Vale Verde"],
  [event("organization.updated", { type: "organization", id: "org" }, { changes: { name: { from: "Vale Verde Ltda.", to: "Vale Verde" } } }), "renomeou a organização para Vale Verde"],
  [event("member.removed", { type: "member", id: "u-bruno" }, { roleId: "role-vv-audit" }), "removeu Bruno Cardoso da organização"],
  [event("member.left", { type: "member", id: "u-helena" }, { roleId: "role-vv-member" }), "saiu da organização"],
  [event("member.role_changed", { type: "member", id: "u-rafael" }, { fromRoleId: "role-vv-member", toRoleId: "role-vv-audit" }), "trocou o papel de Rafael Moreira de MEMBER para Auditoria"],
  [event("invitation.created", { type: "invitation", id: "i" }, { roleId: "role-vv-finance" }), "convidou uma pessoa com o papel Financeiro"],
  [event("invitation.renewed", { type: "invitation", id: "i" }, { roleId: "role-vv-member" }), "renovou por mais 7 dias um convite com o papel MEMBER"],
  [event("invitation.revoked", { type: "invitation", id: "i" }, {}), "revogou um convite pendente"],
  [event("invitation.accepted", { type: "invitation", id: "i" }, { roleId: "role-vv-access", membership: "created" }), "aceitou o convite e entrou com o papel Gestor de acesso"],
  [event("invitation.declined", { type: "invitation", id: "i" }, {}), "recusou um convite"],
  [event("role.created", { type: "role", id: "r" }, { name: "Estoque", permissions: ["estoque:ajustar"] }), "criou o papel Estoque"],
  [event("role.updated", { type: "role", id: "role-vv-finance" }, { changes: { permissionsAdded: ["faturas:aprovar", "relatorios:exportar"], permissionsRemoved: ["estoque:consultar"] } }), "editou o papel Financeiro (+2, −1 permissões)"],
  [event("role.deleted", { type: "role", id: "r" }, { name: "Temporários" }), "excluiu o papel Temporários"],
  [event("permission.created", { type: "permission", id: "contratos:assinar" }, { key: "contratos:assinar", description: "Assinar contratos" }), "criou a permissão contratos:assinar"],
  [event("permission.updated", { type: "permission", id: "estoque:consultar" }, { changes: { description: { from: "a", to: "b" } } }), "mudou a descrição da permissão estoque:consultar"],
  [event("permission.deleted", { type: "permission", id: "estoque:inventariar" }, { key: "estoque:inventariar" }), "excluiu a permissão estoque:inventariar"],
  [event("integration.created", { type: "integration", id: "int-erp" }, { name: "ERP Financeiro", scopes: ["accessflow-api/authorize"] }), "criou a integração ERP Financeiro"],
  [event("integration.revoked", { type: "integration", id: "int-campo" }, { clientId: "1b3d5f7h9j2l4n6p8r0t2v4x6z" }), "revogou a integração App de campo (antigo)"],
];

describe("texto humano da auditoria", () => {
  it("cobre as 18 ações do catálogo", () => {
    expect(CASES.map(([item]) => item.action).toSorted()).toEqual([...AUDIT_ACTIONS].toSorted());
  });

  it.each(CASES)("%#: $action", (item, text) => {
    expect(plainText(describeAuditEvent(item, directory).summary)).toBe(text);
  });

  it("detalhes legíveis: mudanças de → para e permissões com sinal", () => {
    const { details } = describeAuditEvent(CASES[11][0], directory);
    expect(details).toEqual([
      { kind: "permissions", label: "Adicionadas", keys: ["faturas:aprovar", "relatorios:exportar"], sign: "+" },
      { kind: "permissions", label: "Removidas", keys: ["estoque:consultar"], sign: "−" },
    ]);
  });

  it("o que o diretório não conhece vira texto genérico, nunca um id", () => {
    const removed = event("member.removed", { type: "member", id: "u-marcos" }, { roleId: "role-vv-temp" });
    const { summary, details } = describeAuditEvent(removed, directory);
    expect(plainText(summary)).toBe("removeu um ex-membro da organização");
    expect(details).toEqual([{ kind: "text", label: "Papel que tinha", value: "um papel excluído" }]);
  });

  it("nenhum registro das fixtures vira JSON ou id cru no texto", () => {
    for (const item of AUDIT_EVENTS["org-vale-verde"]) {
      const text = plainText(describeAuditEvent(item, directory).summary);
      expect(text).not.toMatch(/[{}]|role-|u-[a-z]|int-/);
    }
  });
});

describe("filtro de resultado das decisões", () => {
  const decision = (results: [string, boolean][]) => ({
    id: "d",
    decidedAt: "2026-11-01T12:00:00.000Z",
    clientId: "c",
    subjectUserId: "u",
    allowed: results.every(([, allowed]) => allowed),
    results: results.map(([permission, allowed]) => ({ permission, allowed })),
    requestId: null,
  });
  const allowed = decision([["faturas:aprovar", true]]);
  const partial = decision([["faturas:aprovar", true], ["contratos:assinar", false]]);
  const denied = decision([["faturas:aprovar", false]]);

  it("mapeia direto para o allowed da API: o parcial entra em Negado", () => {
    expect([allowed, partial, denied].filter((item) => matchesAllowed(item, "allowed"))).toEqual([allowed]);
    expect([allowed, partial, denied].filter((item) => matchesAllowed(item, "denied"))).toEqual([partial, denied]);
    expect([allowed, partial, denied].filter((item) => matchesAllowed(item, null))).toHaveLength(3);
  });

  it("o badge continua distinguindo o parcial", () => {
    expect([allowed, partial, denied].map(decisionOutcome)).toEqual(["allowed", "partial", "denied"]);
  });
});
