/**
 * Eventos de segurança: tentativas negadas que ficam registradas. São só
 * estes quatro; negações fora daqui (não membro, 400, 401) não viram evento.
 */
export const SecurityEventType = {
  /** Membro ativo sem a permissão exigida. */
  ACCESS_FORBIDDEN: 'access.forbidden',
  /** Conceder, retirar ou atribuir permissão que quem age não tem. */
  ACCESS_PRIVILEGE_ESCALATION: 'access.privilege_escalation',
  /** Token de máquina sem o escopo exigido pela rota. */
  MACHINE_SCOPE_DENIED: 'machine.scope_denied',
  /** Client de integração pedindo organização fora do seu vínculo. */
  MACHINE_ORGANIZATION_DENIED: 'machine.organization_denied',
} as const;

export type SecurityEventType =
  (typeof SecurityEventType)[keyof typeof SecurityEventType];

/**
 * O que quem nega sabe da negação, levado pelo próprio erro. O restante do
 * evento vem da requisição na hora de gravar: o usuário autenticado, a
 * operação ou rota, a organização do client e o requestId.
 */
export type SecurityDenial =
  | {
      event: typeof SecurityEventType.ACCESS_FORBIDDEN;
      organizationId: string;
      permission: string;
    }
  | {
      event: typeof SecurityEventType.ACCESS_PRIVILEGE_ESCALATION;
      organizationId: string;
    }
  | {
      event: typeof SecurityEventType.MACHINE_SCOPE_DENIED;
      clientId: string;
      requiredScopes: readonly string[];
    }
  | {
      event: typeof SecurityEventType.MACHINE_ORGANIZATION_DENIED;
      clientId: string;
    };
