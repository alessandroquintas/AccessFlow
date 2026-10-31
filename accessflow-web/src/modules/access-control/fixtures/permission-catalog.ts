import type { PermissionDefinition } from "../schemas";

/** Permissões de sistema, na ordem em que as telas as exibem. */
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

/** Personalizadas da Cooperativa Vale Verde. */
export const CUSTOM_PERMISSIONS: PermissionDefinition[] = [
  { key: "faturas:aprovar", description: "Aprovar faturas de fornecedores" },
  { key: "relatorios:exportar", description: "Exportar relatórios gerenciais" },
  { key: "estoque:ajustar", description: "Ajustar o estoque dos armazéns" },
];
