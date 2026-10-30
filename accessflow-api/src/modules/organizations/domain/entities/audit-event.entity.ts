import { randomUUID } from 'node:crypto';

/** Catálogo das ações auditadas: exatamente uma por mudança efetiva. */
export const AuditAction = {
  ORGANIZATION_CREATED: 'organization.created',
  ORGANIZATION_UPDATED: 'organization.updated',
  MEMBER_REMOVED: 'member.removed',
  MEMBER_LEFT: 'member.left',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  INVITATION_CREATED: 'invitation.created',
  INVITATION_RENEWED: 'invitation.renewed',
  INVITATION_REVOKED: 'invitation.revoked',
  INVITATION_ACCEPTED: 'invitation.accepted',
  INVITATION_DECLINED: 'invitation.declined',
  ROLE_CREATED: 'role.created',
  ROLE_UPDATED: 'role.updated',
  ROLE_DELETED: 'role.deleted',
  PERMISSION_CREATED: 'permission.created',
  PERMISSION_UPDATED: 'permission.updated',
  PERMISSION_DELETED: 'permission.deleted',
  INTEGRATION_CREATED: 'integration.created',
  INTEGRATION_REVOKED: 'integration.revoked',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditTargetType = {
  ORGANIZATION: 'organization',
  MEMBER: 'member',
  INVITATION: 'invitation',
  ROLE: 'role',
  PERMISSION: 'permission',
  INTEGRATION: 'integration',
} as const;

export type AuditTargetType =
  (typeof AuditTargetType)[keyof typeof AuditTargetType];

/** Cada ação tem um tipo de alvo fixo; o id do alvo varia. */
export const TARGET_TYPE_BY_ACTION: Record<AuditAction, AuditTargetType> = {
  'organization.created': AuditTargetType.ORGANIZATION,
  'organization.updated': AuditTargetType.ORGANIZATION,
  'member.removed': AuditTargetType.MEMBER,
  'member.left': AuditTargetType.MEMBER,
  'member.role_changed': AuditTargetType.MEMBER,
  'invitation.created': AuditTargetType.INVITATION,
  'invitation.renewed': AuditTargetType.INVITATION,
  'invitation.revoked': AuditTargetType.INVITATION,
  'invitation.accepted': AuditTargetType.INVITATION,
  'invitation.declined': AuditTargetType.INVITATION,
  'role.created': AuditTargetType.ROLE,
  'role.updated': AuditTargetType.ROLE,
  'role.deleted': AuditTargetType.ROLE,
  'permission.created': AuditTargetType.PERMISSION,
  'permission.updated': AuditTargetType.PERMISSION,
  'permission.deleted': AuditTargetType.PERMISSION,
  'integration.created': AuditTargetType.INTEGRATION,
  'integration.revoked': AuditTargetType.INTEGRATION,
};

const ACTIONS: ReadonlySet<string> = new Set(Object.values(AuditAction));
const TARGET_TYPES: ReadonlySet<string> = new Set(
  Object.values(AuditTargetType),
);

export function isAuditAction(value: string): value is AuditAction {
  return ACTIONS.has(value);
}

export function isAuditTargetType(value: string): value is AuditTargetType {
  return TARGET_TYPES.has(value);
}

export const AuditActorType = {
  USER: 'USER',
  /** Fase 9b: client de integração. */
  MACHINE: 'MACHINE',
  /** Fase 9b: ações do próprio sistema. */
  SYSTEM: 'SYSTEM',
} as const;

export type AuditActorType =
  (typeof AuditActorType)[keyof typeof AuditActorType];

export type AuditActor =
  | { type: typeof AuditActorType.USER; userId: string }
  | { type: typeof AuditActorType.MACHINE; clientId: string }
  | { type: typeof AuditActorType.SYSTEM };

/** Ator de uma ação feita por um usuário autenticado. */
export function userActor(userId: string): AuditActor {
  return { type: AuditActorType.USER, userId };
}

export interface AuditChange<T> {
  from: T;
  to: T;
}

/**
 * O `details` de cada ação. Só ids e dados que não são pessoais (nome de
 * papel, chave e descrição de permissão, nome e slug da organização): nada
 * de e-mail ou nome de pessoa.
 */
export interface AuditDetailsByAction {
  'organization.created': { name: string; slug: string };
  'organization.updated': { changes: { name?: AuditChange<string> } };
  'member.removed': { roleId: string };
  'member.left': { roleId: string };
  'member.role_changed': { fromRoleId: string; toRoleId: string };
  'invitation.created': { roleId: string };
  'invitation.renewed': { roleId: string; previousRoleId?: string };
  'invitation.revoked': Record<string, never>;
  /** `roleId`: o papel do membership depois do aceite. */
  'invitation.accepted': {
    roleId: string;
    memberUserId: string;
    membership: 'created' | 'reactivated' | 'unchanged';
  };
  'invitation.declined': Record<string, never>;
  'role.created': { name: string; permissions: string[] };
  'role.updated': {
    changes: {
      name?: AuditChange<string>;
      permissionsAdded?: string[];
      permissionsRemoved?: string[];
    };
  };
  'role.deleted': { name: string };
  'permission.created': { key: string; description: string };
  'permission.updated': { changes: { description: AuditChange<string> } };
  'permission.deleted': { key: string };
  /** Nunca o client_secret: ele não chega ao domínio. */
  'integration.created': { name: string; scopes: string[]; clientId: string };
  'integration.revoked': { clientId: string };
}

// Falha de compilação se uma ação do catálogo ficar sem tipo de details.
const DETAILS_COVER_EVERY_ACTION: Exclude<
  AuditAction,
  keyof AuditDetailsByAction
> extends never
  ? true
  : false = true;
void DETAILS_COVER_EVERY_ACTION;

export type AuditDetails = Readonly<Record<string, unknown>>;

export interface AuditEventProps {
  id: string;
  organizationId: string;
  actor: AuditActor;
  action: AuditAction;
  target: { type: AuditTargetType; id: string };
  details: AuditDetails;
  occurredAt: Date;
}

/**
 * Registro de uma mudança administrativa numa organização. Imutável: não
 * há método que o altere, e a tabela só aceita INSERT.
 *
 * As validações aqui lançam Error comum, e não DomainError: um evento mal
 * formado é erro de programação, e falha fechado (500), sem truncar nada.
 */
export class AuditEvent {
  /**
   * Teto do `details` em JSON (UTF-8). O maior details legítimo é o de um
   * papel com o catálogo efetivo inteiro (9 de sistema + 100 personalizadas
   * de até 81 caracteres), perto de 10 KB.
   */
  static readonly MAX_DETAILS_BYTES = 16 * 1024;

  private constructor(private readonly props: AuditEventProps) {}

  static create<A extends AuditAction>(
    input: {
      organizationId: string;
      actor: AuditActor;
      action: A;
      targetId: string;
      details: AuditDetailsByAction[A];
    },
    occurredAt: Date,
  ): AuditEvent {
    return AuditEvent.restore({
      id: randomUUID(),
      organizationId: input.organizationId,
      actor: input.actor,
      action: input.action,
      target: { type: TARGET_TYPE_BY_ACTION[input.action], id: input.targetId },
      details: input.details,
      occurredAt,
    });
  }

  static restore(props: AuditEventProps): AuditEvent {
    if (!props.id?.trim()) throw new Error('AuditEvent sem id.');
    if (!props.organizationId?.trim()) {
      throw new Error('AuditEvent sem organizationId.');
    }
    if (!isAuditAction(props.action)) {
      throw new Error(
        `AuditEvent com ação desconhecida: ${String(props.action)}`,
      );
    }
    if (props.target.type !== TARGET_TYPE_BY_ACTION[props.action]) {
      throw new Error(`AuditEvent com alvo errado para ${props.action}.`);
    }
    if (!props.target.id?.trim()) throw new Error('AuditEvent sem alvo.');
    assertValidActor(props.actor);
    assertDetailsSize(props.details);

    return new AuditEvent({
      ...props,
      actor: { ...props.actor },
      target: { ...props.target },
      details: structuredClone(props.details),
    });
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get actor(): AuditActor {
    return this.props.actor;
  }
  get action(): AuditAction {
    return this.props.action;
  }
  get target(): { type: AuditTargetType; id: string } {
    return this.props.target;
  }
  get details(): AuditDetails {
    return this.props.details;
  }
  get occurredAt(): Date {
    return this.props.occurredAt;
  }
}

function assertValidActor(actor: AuditActor): void {
  const valid =
    (actor?.type === AuditActorType.USER && !!actor.userId?.trim()) ||
    (actor?.type === AuditActorType.MACHINE && !!actor.clientId?.trim()) ||
    actor?.type === AuditActorType.SYSTEM;
  if (!valid) throw new Error('AuditEvent com ator inválido.');
}

function assertDetailsSize(details: AuditDetails): void {
  if (
    details === null ||
    typeof details !== 'object' ||
    Array.isArray(details)
  ) {
    throw new Error('AuditEvent.details precisa ser um objeto.');
  }
  // Só o tamanho na mensagem: o conteúdo não vai para o log.
  const bytes = new TextEncoder().encode(JSON.stringify(details)).length;
  if (bytes > AuditEvent.MAX_DETAILS_BYTES) {
    throw new Error(
      `AuditEvent.details com ${bytes} bytes; o limite é ${AuditEvent.MAX_DETAILS_BYTES}.`,
    );
  }
}
