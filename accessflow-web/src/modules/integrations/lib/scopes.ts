import type { IntegrationScope } from "../schemas";

/** O que cada escopo permite à integração e as permissões que quem cria precisa ter (anti-escalada). */
export const SCOPE_INFO: Record<IntegrationScope, { description: string; requires: string[] }> = {
  "accessflow-api/members.read": {
    description: "Consultar se um usuário é membro",
    requires: ["members:read"],
  },
  "accessflow-api/authorize": {
    description: "Perguntar se um usuário pode executar uma ação",
    requires: ["members:read", "roles:read"],
  },
};

/**
 * As permissões que faltam ao viewer para conceder o escopo; vazio quando
 * pode. Só estado de tela: a API decide de novo (PRIVILEGE_ESCALATION).
 */
export const missingForScope = (scope: IntegrationScope, viewerPermissions: readonly string[]) =>
  SCOPE_INFO[scope].requires.filter((key) => !viewerPermissions.includes(key));
