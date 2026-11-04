import { z } from "zod";

/** As 18 ações auditadas (AuditAction no accessflow-api): uma por mudança efetiva. */
export const AUDIT_ACTIONS = [
  "organization.created",
  "organization.updated",
  "member.removed",
  "member.left",
  "member.role_changed",
  "invitation.created",
  "invitation.renewed",
  "invitation.revoked",
  "invitation.accepted",
  "invitation.declined",
  "role.created",
  "role.updated",
  "role.deleted",
  "permission.created",
  "permission.updated",
  "permission.deleted",
  "integration.created",
  "integration.revoked",
] as const;

export const auditActionSchema = z.enum(AUDIT_ACTIONS);

export const actorSchema = z.object({
  type: z.enum(["USER", "MACHINE", "SYSTEM"]),
  userId: z.string().nullable(),
  /** Nome atual do usuário; nulo se o perfil não for encontrado. */
  name: z.string().nullable(),
  clientId: z.string().nullable(),
});

const change = z.object({ from: z.string(), to: z.string() });

/**
 * Os detalhes de cada ação. A API manda um JSON serializado (`details:
 * String!`); na Fase 11b, o hook faz o JSON.parse e valida com este schema.
 * Sem e-mail nem nome de pessoa: os ids são resolvidos pelo diretório.
 */
export const auditDetailsSchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
  key: z.string().optional(),
  description: z.string().optional(),
  roleId: z.string().optional(),
  previousRoleId: z.string().optional(),
  fromRoleId: z.string().optional(),
  toRoleId: z.string().optional(),
  memberUserId: z.string().optional(),
  membership: z.enum(["created", "reactivated", "unchanged"]).optional(),
  permissions: z.array(z.string()).optional(),
  scopes: z.array(z.string()).optional(),
  clientId: z.string().optional(),
  changes: z
    .object({
      name: change.optional(),
      description: change.optional(),
      permissionsAdded: z.array(z.string()).optional(),
      permissionsRemoved: z.array(z.string()).optional(),
    })
    .optional(),
});

/** Registro da trilha administrativa (equivale ao `AuditEvent`). */
export const auditEventSchema = z.object({
  id: z.string(),
  action: auditActionSchema,
  actor: actorSchema,
  target: z.object({
    type: z.enum(["organization", "member", "invitation", "role", "permission", "integration"]),
    /** O userId para member e a chave para permission. */
    id: z.string(),
  }),
  details: auditDetailsSchema,
  occurredAt: z.iso.datetime(),
  requestId: z.string().nullable(),
});

/** Resposta do POST /v1/authorize (equivale ao `AuthorizationDecision`). */
export const decisionSchema = z.object({
  id: z.string(),
  decidedAt: z.iso.datetime(),
  clientId: z.string(),
  /** Sobre quem se perguntou; pode nem existir como usuário. */
  subjectUserId: z.string(),
  allowed: z.boolean(),
  results: z.array(z.object({ permission: z.string(), allowed: z.boolean() })),
  requestId: z.string().nullable(),
});

export const SECURITY_EVENTS = [
  "access.forbidden",
  "access.privilege_escalation",
  "machine.scope_denied",
  "machine.organization_denied",
] as const;

/** Tentativa negada (equivale ao `SecurityEvent`). */
export const securityEventSchema = z.object({
  id: z.string(),
  event: z.enum(SECURITY_EVENTS),
  actor: actorSchema,
  /** operation e permission nos access.*; route e requiredScopes nos machine.*. */
  details: z.object({
    operation: z.string().optional(),
    permission: z.string().optional(),
    route: z.string().optional(),
    requiredScopes: z.array(z.string()).optional(),
  }),
  occurredAt: z.iso.datetime(),
  requestId: z.string().nullable(),
});

/**
 * Nomes para os ids que a API devolve. Fase 11b: vêm de organizationMembers
 * (members:read), organizationRoles (roles:read) e integrationClients
 * (integrations:read); sem a permissão, o texto cai no genérico.
 */
export interface AuditDirectory {
  members: Record<string, string>;
  roles: Record<string, string>;
  /** Por id da integração e por client_id. */
  integrations: Record<string, string>;
}

export type AuditAction = z.infer<typeof auditActionSchema>;
export type AuditActor = z.infer<typeof actorSchema>;
export type AuditDetails = z.infer<typeof auditDetailsSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type SecurityEventType = (typeof SECURITY_EVENTS)[number];
export type SecurityEvent = z.infer<typeof securityEventSchema>;
