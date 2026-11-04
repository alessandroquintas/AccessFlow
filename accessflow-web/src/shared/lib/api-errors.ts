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
  PRIVILEGE_ESCALATION: "Você só pode conceder ou tirar papéis cujas permissões você tem.",
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_MESSAGES;

const FALLBACK = "Não foi possível concluir a ação. Tente de novo em instantes.";

export const apiErrorMessage = (code: string) =>
  API_ERROR_MESSAGES[code as ApiErrorCode] ?? FALLBACK;
