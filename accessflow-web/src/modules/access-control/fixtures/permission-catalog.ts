import type { PermissionDefinition } from "../schemas";

/** Permissões de sistema, na ordem do catálogo da API (é a ordem em que as telas as exibem). */
export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  { key: "organizations:update", description: "Editar os dados da organização" },
  { key: "members:read", description: "Ver os membros" },
  { key: "members:invite", description: "Convidar membros e revogar convites" },
  { key: "members:remove", description: "Remover membros" },
  { key: "roles:read", description: "Ver os papéis e suas permissões" },
  { key: "roles:manage", description: "Criar, editar e apagar papéis" },
  { key: "roles:assign", description: "Trocar o papel de um membro" },
  { key: "permissions:manage", description: "Criar, editar e excluir permissões personalizadas" },
  { key: "audit:read", description: "Ver o registro de auditoria" },
  { key: "integrations:read", description: "Ver as integrações e os escopos de cada uma" },
  { key: "integrations:manage", description: "Criar e revogar integrações" },
];

/** Personalizadas de cada organização (por id), por chave, como o `organizationPermissions`. */
export const CUSTOM_PERMISSIONS: Record<string, PermissionDefinition[]> = {
  "org-vale-verde": [
    { key: "contratos:assinar", description: "Assinar contratos com fornecedores" },
    { key: "cooperados:cadastrar", description: "Cadastrar novos cooperados" },
    { key: "estoque:ajustar", description: "Ajustar o estoque dos armazéns" },
    { key: "estoque:consultar", description: "Consultar o estoque dos armazéns" },
    { key: "faturas:aprovar", description: "Aprovar faturas de fornecedores" },
    { key: "relatorios:exportar", description: "Exportar relatórios gerenciais" },
  ],
  "org-atlantico": [
    { key: "amostras:liberar", description: "Liberar amostras para análise" },
    { key: "laudos:assinar", description: "Assinar laudos técnicos" },
  ],
};

/**
 * Limites usados pelas telas. Os da API são 50 papéis personalizados e 100
 * permissões; o Laboratório Atlântico usa limites reduzidos só para revisar
 * o estado de "limite atingido". Fase 11b: some (os limites vêm da API ou
 * ficam fixos nos schemas).
 */
export const DESIGN_LIMITS: Record<string, { customRoles: number; customPermissions: number }> = {
  "org-atlantico": { customRoles: 1, customPermissions: 2 },
};
