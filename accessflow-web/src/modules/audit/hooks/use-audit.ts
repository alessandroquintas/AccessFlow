"use client";

import { AUDIT_DIRECTORY, AUDIT_EVENTS, DECISIONS, SECURITY_EVENTS_BY_ORG } from "../fixtures/audit";
import type { AuditDirectory } from "../schemas";

const EMPTY_DIRECTORY: AuditDirectory = { members: {}, roles: {}, integrations: {} };

/**
 * Os três registros da organização e o diretório de nomes. Fase 11b:
 * auditEvents, authorizationDecisions e securityEvents (paginados, com o
 * filtro no servidor) e o diretório montado a partir de organizationMembers,
 * organizationRoles e integrationClients.
 */
export function useAudit(organizationId: string) {
  return {
    events: AUDIT_EVENTS[organizationId] ?? [],
    decisions: DECISIONS[organizationId] ?? [],
    security: SECURITY_EVENTS_BY_ORG[organizationId] ?? [],
    directory: AUDIT_DIRECTORY[organizationId] ?? EMPTY_DIRECTORY,
  };
}
