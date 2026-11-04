import type { AuditActor, AuditDirectory, AuditEvent, Decision, SecurityEvent } from "../schemas";

const HOUR = 60 * 60 * 1000;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();
const DAY = 24;

const user = (userId: string, name: string | null): AuditActor => ({ type: "USER", userId, name, clientId: null });
const machine = (clientId: string): AuditActor => ({ type: "MACHINE", userId: null, name: null, clientId });

const HELENA = user("u-helena", "Helena Duarte");
const CAMILA = user("u-camila", "Camila Teixeira");
const GUSTAVO = user("u-gustavo", "Gustavo Amaral");
const SOFIA = user("u-sofia", "Sofia Campos");
const RAFAEL = user("u-rafael", "Rafael Moreira");

const ERP = "4f1c9a2e7b8d3c6a5e0f1b2d9c";
const PORTAL = "7k2m9p4q1r8s5t3v6w0x2y4z8a";
const CAMPO = "1b3d5f7h9j2l4n6p8r0t2v4x6z";
/** client_id de outra organização (LIMS, do Laboratório Atlântico). */
const LIMS = "9c8b7a6d5e4f3g2h1j0k9l8m7n";

/** requestId no formato que a API registra (X-Request-Id). */
const rid = (seed: number) => `req-${(seed * 2654435761).toString(16).padStart(8, "0").slice(-8)}-${seed.toString(16).padStart(4, "0")}`;

type EventInput = Omit<AuditEvent, "id" | "occurredAt" | "requestId"> & { hours: number; requestId?: boolean };

const events = (prefix: string, list: EventInput[]): AuditEvent[] =>
  list.map(({ hours, requestId = true, ...event }, index) => ({
    ...event,
    id: `${prefix}-${index}`,
    occurredAt: hoursAgo(hours),
    requestId: requestId ? rid(index + 1) : null,
  }));

/** A trilha de cada organização (por id), da mais recente para a mais antiga. */
export const AUDIT_EVENTS: Record<string, AuditEvent[]> = {
  "org-vale-verde": events("evt-vv", [
    {
      hours: 0.25,
      action: "integration.created",
      actor: GUSTAVO,
      target: { type: "integration", id: "int-bi" },
      details: { name: "BI Relatórios", scopes: ["accessflow-api/authorize"] },
    },
    {
      hours: 2,
      action: "invitation.accepted",
      actor: SOFIA,
      target: { type: "invitation", id: "inv-sofia" },
      details: { roleId: "role-vv-access", memberUserId: "u-sofia", membership: "created" },
    },
    {
      hours: 5,
      action: "invitation.created",
      actor: CAMILA,
      target: { type: "invitation", id: "oinv-tiago" },
      details: { roleId: "role-vv-finance" },
    },
    {
      hours: 20,
      action: "member.role_changed",
      actor: HELENA,
      target: { type: "member", id: "u-bruno" },
      details: { fromRoleId: "role-vv-member", toRoleId: "role-vv-audit" },
    },
    {
      hours: 28,
      action: "role.updated",
      actor: HELENA,
      target: { type: "role", id: "role-vv-finance" },
      details: { changes: { permissionsAdded: ["faturas:aprovar", "relatorios:exportar"], permissionsRemoved: ["estoque:consultar"] } },
    },
    {
      hours: 2 * DAY + 3,
      action: "invitation.revoked",
      actor: HELENA,
      target: { type: "invitation", id: "oinv-paula" },
      details: {},
      requestId: false,
    },
    {
      hours: 3 * DAY,
      action: "invitation.declined",
      actor: user("u-jorge", "Jorge Matos"),
      target: { type: "invitation", id: "oinv-jorge" },
      details: {},
    },
    {
      hours: 5 * DAY,
      action: "integration.created",
      actor: HELENA,
      target: { type: "integration", id: "int-erp" },
      details: { name: "ERP Financeiro", scopes: ["accessflow-api/members.read", "accessflow-api/authorize"] },
    },
    {
      hours: 6 * DAY + 4,
      action: "member.removed",
      actor: HELENA,
      target: { type: "member", id: "u-marcos" },
      details: { roleId: "role-vv-member" },
    },
    {
      hours: 7 * DAY,
      action: "permission.created",
      actor: HELENA,
      target: { type: "permission", id: "contratos:assinar" },
      details: { key: "contratos:assinar", description: "Assinar contratos com fornecedores" },
    },
    {
      hours: 8 * DAY,
      action: "role.created",
      actor: HELENA,
      target: { type: "role", id: "role-vv-stock" },
      details: { name: "Estoque", permissions: ["members:read", "estoque:ajustar", "estoque:consultar"] },
    },
    {
      hours: 9 * DAY,
      action: "permission.updated",
      actor: HELENA,
      target: { type: "permission", id: "estoque:consultar" },
      details: { changes: { description: { from: "Ver o estoque", to: "Consultar o estoque dos armazéns" } } },
    },
    {
      hours: 10 * DAY,
      action: "invitation.renewed",
      actor: CAMILA,
      target: { type: "invitation", id: "oinv-otavio" },
      details: { roleId: "role-vv-member", previousRoleId: "role-vv-audit" },
    },
    {
      hours: 11 * DAY,
      action: "invitation.renewed",
      actor: CAMILA,
      target: { type: "invitation", id: "oinv-debora" },
      details: { roleId: "role-vv-member" },
    },
    {
      hours: 14 * DAY,
      action: "member.left",
      actor: user("u-paulo", "Paulo Vieira"),
      target: { type: "member", id: "u-paulo" },
      details: { roleId: "role-vv-finance" },
    },
    {
      hours: 16 * DAY,
      action: "role.deleted",
      actor: HELENA,
      target: { type: "role", id: "role-vv-temp" },
      details: { name: "Temporários" },
    },
    {
      hours: 18 * DAY,
      action: "permission.deleted",
      actor: HELENA,
      target: { type: "permission", id: "estoque:inventariar" },
      details: { key: "estoque:inventariar" },
    },
    {
      hours: 20 * DAY,
      action: "organization.updated",
      actor: HELENA,
      target: { type: "organization", id: "org-vale-verde" },
      details: { changes: { name: { from: "Cooperativa Vale Verde Ltda.", to: "Cooperativa Vale Verde" } } },
    },
    {
      hours: 22 * DAY,
      action: "role.updated",
      actor: HELENA,
      target: { type: "role", id: "role-vv-access" },
      details: { changes: { name: { from: "Acessos", to: "Gestor de acesso" }, permissionsAdded: ["roles:manage"] } },
    },
    {
      hours: 25 * DAY,
      action: "invitation.accepted",
      actor: user("u-wesley", "Wesley Cabral"),
      target: { type: "invitation", id: "inv-wesley" },
      details: { roleId: "role-vv-member", memberUserId: "u-wesley", membership: "reactivated" },
    },
    {
      hours: 30 * DAY,
      action: "integration.revoked",
      actor: HELENA,
      target: { type: "integration", id: "int-campo" },
      details: { clientId: CAMPO },
    },
    {
      hours: 33 * DAY,
      action: "invitation.created",
      actor: HELENA,
      target: { type: "invitation", id: "inv-wesley" },
      details: { roleId: "role-vv-member" },
    },
    {
      hours: 38 * DAY,
      action: "member.role_changed",
      actor: HELENA,
      target: { type: "member", id: "u-larissa" },
      details: { fromRoleId: "role-vv-member", toRoleId: "role-vv-audit" },
    },
    {
      hours: 41 * DAY,
      action: "integration.created",
      actor: HELENA,
      target: { type: "integration", id: "int-portal" },
      details: { name: "Portal do Cooperado", scopes: ["accessflow-api/members.read"] },
    },
    {
      hours: 47 * DAY,
      action: "role.updated",
      actor: GUSTAVO,
      target: { type: "role", id: "role-vv-member" },
      details: { changes: { permissionsRemoved: ["audit:read"] } },
    },
    {
      hours: 52 * DAY,
      action: "member.removed",
      actor: GUSTAVO,
      target: { type: "member", id: "u-julio" },
      details: { roleId: "role-vv-temp" },
    },
    {
      hours: 415 * DAY,
      action: "organization.created",
      actor: HELENA,
      target: { type: "organization", id: "org-vale-verde" },
      details: { name: "Cooperativa Vale Verde Ltda.", slug: "vale-verde" },
    },
  ]),
  "org-atlantico": events("evt-at", [
    {
      hours: 6 * DAY + 4,
      action: "invitation.created",
      actor: user("u-marina", "Marina Albuquerque"),
      target: { type: "invitation", id: "oinv-renata" },
      details: { roleId: "role-at-research" },
    },
    {
      hours: 9 * DAY,
      action: "integration.created",
      actor: HELENA,
      target: { type: "integration", id: "int-lims" },
      details: { name: "LIMS Amostras", scopes: ["accessflow-api/members.read", "accessflow-api/authorize"] },
    },
    {
      hours: 12 * DAY,
      action: "role.created",
      actor: HELENA,
      target: { type: "role", id: "role-at-research" },
      details: { name: "Pesquisa", permissions: ["members:read", "roles:read"] },
    },
    {
      hours: 205 * DAY,
      action: "organization.created",
      actor: HELENA,
      target: { type: "organization", id: "org-atlantico" },
      details: { name: "Laboratório Atlântico", slug: "laboratorio-atlantico" },
    },
  ]),
};

type DecisionInput = [hours: number, clientId: string, subjectUserId: string, results: [string, boolean][]];

const decisions = (prefix: string, list: DecisionInput[]): Decision[] =>
  list.map(([hours, clientId, subjectUserId, results], index) => ({
    id: `${prefix}-${index}`,
    decidedAt: hoursAgo(hours),
    clientId,
    subjectUserId,
    allowed: results.every(([, allowed]) => allowed),
    results: results.map(([permission, allowed]) => ({ permission, allowed })),
    requestId: index % 4 === 3 ? null : rid(100 + index),
  }));

/** Quem não existe como usuário: a integração pode perguntar sobre qualquer id. */
const UNKNOWN = "5d0e8c1a-7f2b-4c9e-a613-0b8d4e2f9a71";

/** Decisões de acesso de cada organização (retenção de 90 dias), da mais recente para a mais antiga. */
export const DECISIONS: Record<string, Decision[]> = {
  "org-vale-verde": decisions("dec-vv", [
    [0.1, ERP, "u-marta", [["faturas:aprovar", true]]],
    [0.6, ERP, "u-rafael", [["faturas:aprovar", false]]],
    [1.5, ERP, "u-daniel", [["faturas:aprovar", true], ["relatorios:exportar", true]]],
    [3, ERP, "u-bruno", [["faturas:aprovar", false], ["relatorios:exportar", false]]],
    [5, ERP, "u-priscila", [["faturas:aprovar", true], ["contratos:assinar", false]]],
    [9, ERP, UNKNOWN, [["faturas:aprovar", false]]],
    [20, ERP, "u-marta", [["relatorios:exportar", true]]],
    [26, ERP, "u-roberto", [["faturas:aprovar", true], ["relatorios:exportar", true], ["contratos:assinar", false]]],
    [2 * DAY, ERP, "u-gustavo", [["contratos:assinar", false]]],
    [3 * DAY, ERP, "u-helena", [["contratos:assinar", true], ["faturas:aprovar", true]]],
    [4 * DAY, ERP, "u-isabela", [["relatorios:exportar", false]]],
    [6 * DAY, ERP, "u-marta", [["faturas:aprovar", true]]],
    [8 * DAY, ERP, "u-eduardo", [["estoque:ajustar", false]]],
    [10 * DAY, ERP, "u-daniel", [["faturas:aprovar", true]]],
    [13 * DAY, ERP, "u-rafael", [["relatorios:exportar", false]]],
    [16 * DAY, ERP, "u-priscila", [["faturas:aprovar", true], ["relatorios:exportar", true]]],
    [21 * DAY, ERP, "u-bruno", [["relatorios:exportar", false]]],
    [27 * DAY, ERP, "u-helena", [["estoque:ajustar", true], ["estoque:consultar", true]]],
    [33 * DAY, CAMPO, "u-eduardo", [["estoque:consultar", false]]],
    [36 * DAY, CAMPO, "u-leticia", [["estoque:consultar", false], ["estoque:ajustar", false]]],
    [48 * DAY, CAMPO, "u-gustavo", [["estoque:consultar", true]]],
    [70 * DAY, CAMPO, "u-marta", [["estoque:ajustar", false]]],
  ]),
  "org-atlantico": decisions("dec-at", [
    [4, LIMS, "u-caio", [["amostras:liberar", true]]],
    [30, LIMS, "u-heitor", [["amostras:liberar", false], ["laudos:assinar", false]]],
  ]),
};

type SecurityInput = Omit<SecurityEvent, "id" | "occurredAt" | "requestId"> & { hours: number };

const security = (prefix: string, list: SecurityInput[]): SecurityEvent[] =>
  list.map(({ hours, ...event }, index) => ({
    ...event,
    id: `${prefix}-${index}`,
    occurredAt: hoursAgo(hours),
    requestId: index % 3 === 2 ? null : rid(200 + index),
  }));

/** Tentativas negadas de cada organização (retenção de 180 dias), da mais recente para a mais antiga. */
export const SECURITY_EVENTS_BY_ORG: Record<string, SecurityEvent[]> = {
  "org-vale-verde": security("sec-vv", [
    {
      hours: 1,
      event: "access.forbidden",
      actor: RAFAEL,
      details: { operation: "organizationRoles", permission: "roles:read" },
    },
    {
      hours: 4,
      event: "machine.scope_denied",
      actor: machine(PORTAL),
      details: { route: "POST /v1/authorize", requiredScopes: ["accessflow-api/authorize"] },
    },
    {
      hours: 30,
      event: "access.privilege_escalation",
      actor: CAMILA,
      details: { operation: "updateRole" },
    },
    {
      hours: 2 * DAY,
      event: "machine.organization_denied",
      actor: machine(LIMS),
      details: { route: "GET /v1/organizations/:organizationId/members/:userId" },
    },
    {
      hours: 5 * DAY,
      event: "access.forbidden",
      actor: RAFAEL,
      details: { operation: "auditEvents", permission: "audit:read" },
    },
    {
      hours: 9 * DAY,
      event: "access.forbidden",
      actor: CAMILA,
      details: { operation: "removeMember", permission: "members:remove" },
    },
    {
      hours: 15 * DAY,
      event: "access.privilege_escalation",
      actor: CAMILA,
      details: { operation: "assignRole" },
    },
    {
      hours: 40 * DAY,
      event: "machine.scope_denied",
      actor: machine(PORTAL),
      details: { route: "POST /v1/authorize", requiredScopes: ["accessflow-api/authorize"] },
    },
    {
      hours: 90 * DAY,
      event: "access.forbidden",
      actor: user("u-paulo", null),
      details: { operation: "createIntegrationClient", permission: "integrations:manage" },
    },
  ]),
  "org-atlantico": security("sec-at", [
    {
      hours: 3 * DAY,
      event: "access.forbidden",
      actor: CAMILA,
      details: { operation: "organizationRoles", permission: "roles:read" },
    },
  ]),
};

/** Nomes para os ids (ver AuditDirectory). Ex-membros e papéis excluídos ficam de fora, como na API. */
export const AUDIT_DIRECTORY: Record<string, AuditDirectory> = {
  "org-vale-verde": {
    members: {
      "u-helena": "Helena Duarte",
      "u-camila": "Camila Teixeira",
      "u-rafael": "Rafael Moreira",
      "u-bruno": "Bruno Cardoso",
      "u-sofia": "Sofia Campos",
      "u-gustavo": "Gustavo Amaral",
      "u-marta": "Marta Lacerda",
      "u-daniel": "Daniel Azevedo",
      "u-priscila": "Priscila Carvalho",
      "u-roberto": "Roberto Saldanha",
      "u-isabela": "Isabela Rocha",
      "u-eduardo": "Eduardo Pires",
      "u-leticia": "Letícia Fontes",
      "u-larissa": "Larissa Viana",
      "u-wesley": "Wesley Cabral",
    },
    roles: {
      "role-vv-owner": "OWNER",
      "role-vv-member": "MEMBER",
      "role-vv-admin": "Administração",
      "role-vv-audit": "Auditoria",
      "role-vv-stock": "Estoque",
      "role-vv-finance": "Financeiro",
      "role-vv-access": "Gestor de acesso",
    },
    integrations: {
      "int-bi": "BI Relatórios",
      "int-erp": "ERP Financeiro",
      "int-portal": "Portal do Cooperado",
      "int-campo": "App de campo (antigo)",
      [ERP]: "ERP Financeiro",
      [PORTAL]: "Portal do Cooperado",
      [CAMPO]: "App de campo (antigo)",
    },
  },
  "org-atlantico": {
    members: { "u-helena": "Helena Duarte", "u-marina": "Marina Albuquerque", "u-caio": "Caio Furtado", "u-heitor": "Heitor Bezerra", "u-camila": "Camila Teixeira" },
    roles: { "role-at-owner": "OWNER", "role-at-member": "MEMBER", "role-at-research": "Pesquisa" },
    integrations: { "int-lims": "LIMS Amostras", [LIMS]: "LIMS Amostras" },
  },
};
