/**
 * Mapa de mensagens: o `code` dos erros de domínio da API (ver
 * domain-error.filter.ts no accessflow-api) no texto que a pessoa lê. Diz o
 * que houve e o que fazer (docs/design-direction.md, "Tom dos textos").
 */
export const API_ERROR_MESSAGES = {
  ALREADY_MEMBER: "Este e-mail já pertence a um membro da organização. Para mudar o acesso dele, troque o papel em Membros.",
  INVITATION_LIMIT_REACHED: "A organização atingiu o limite de convites pendentes. Revogue convites antigos antes de enviar outro.",
  INVITATION_NOT_FOUND: "Este convite não está mais pendente. Atualize a lista para ver o status atual.",
  LAST_OWNER: "A organização precisa ter pelo menos um OWNER. Torne outro membro OWNER antes.",
  MEMBER_NOT_FOUND: "Esta pessoa não é mais membro da organização. Atualize a lista.",
  ORGANIZATION_PERMISSION_DENIED: "Você não tem mais permissão para esta ação. Atualize a página para ver o que mudou.",
  PRIVILEGE_ESCALATION: "Você só pode conceder ou tirar papéis e permissões que você mesmo tem.",
  ROLE_NAME_TAKEN: "Já existe um papel com esse nome. Escolha outro nome.",
  ROLE_LIMIT_REACHED: "A organização atingiu o limite de papéis personalizados. Exclua um papel sem uso antes de criar outro.",
  SYSTEM_ROLE_IMMUTABLE: "Papéis de sistema não mudam de nome e o OWNER não muda de permissões.",
  ROLE_IN_USE: "Este papel ainda tem membros ou convites pendentes. Troque o papel deles antes de excluir.",
  INVALID_PERMISSION_KEY: "A chave não está no formato recurso:ação, com letras minúsculas, dígitos e hífen.",
  RESERVED_PERMISSION_RESOURCE: "O recurso da chave é do sistema. Escolha outro nome para o recurso.",
  PERMISSION_KEY_TAKEN: "Já existe uma permissão com essa chave. Escolha outra chave.",
  PERMISSION_LIMIT_REACHED: "A organização atingiu o limite de permissões personalizadas. Exclua uma sem uso antes de criar outra.",
  INTEGRATION_LIMIT_REACHED: "A organização atingiu o limite de integrações ativas ou em criação. Revogue uma que não é mais usada.",
  INTEGRATION_PROVISIONING_FAILED: "O provedor de login não concluiu a criação. A tentativa ficou como “Falhou” e não ocupa vaga; tente de novo.",
  INTEGRATION_NOT_ACTIVE: "Esta integração não está ativa: ainda está em criação ou já foi revogada. Atualize a lista.",
  PERMISSION_IN_USE: "Esta permissão ainda é concedida por algum papel. Tire-a dos papéis antes de excluir.",
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_MESSAGES;

const FALLBACK = "Não foi possível concluir a ação. Tente de novo em instantes.";

export const apiErrorMessage = (code: string) =>
  API_ERROR_MESSAGES[code as ApiErrorCode] ?? FALLBACK;
