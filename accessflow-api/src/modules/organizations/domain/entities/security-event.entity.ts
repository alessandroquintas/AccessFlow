import { randomUUID } from 'node:crypto';
import { SecurityEventType } from '@/shared/domain/security-denial';

export { SecurityEventType };

const EVENT_TYPES: ReadonlySet<string> = new Set(
  Object.values(SecurityEventType),
);

export function isSecurityEventType(value: string): value is SecurityEventType {
  return EVENT_TYPES.has(value);
}

export const SecurityActorType = {
  USER: 'USER',
  MACHINE: 'MACHINE',
} as const;

export type SecurityActorType =
  (typeof SecurityActorType)[keyof typeof SecurityActorType];

export type SecurityActor =
  | { type: typeof SecurityActorType.USER; userId: string }
  | { type: typeof SecurityActorType.MACHINE; clientId: string };

/**
 * O `details` de cada evento: nomes de operação e de rota, chaves de
 * permissão e escopos. Nada que venha de texto livre de quem pediu, então
 * nada de e-mail ou nome de pessoa.
 */
export interface SecurityDetailsByEvent {
  'access.forbidden': { operation: string; permission: string };
  'access.privilege_escalation': { operation: string };
  'machine.scope_denied': { route: string; requiredScopes: string[] };
  'machine.organization_denied': { route: string };
}

/** As chaves exatas de cada details, e de que tipo de ator é o evento. */
const SHAPE: Record<
  SecurityEventType,
  { actor: SecurityActorType; keys: readonly string[] }
> = {
  'access.forbidden': {
    actor: SecurityActorType.USER,
    keys: ['operation', 'permission'],
  },
  'access.privilege_escalation': {
    actor: SecurityActorType.USER,
    keys: ['operation'],
  },
  'machine.scope_denied': {
    actor: SecurityActorType.MACHINE,
    keys: ['requiredScopes', 'route'],
  },
  'machine.organization_denied': {
    actor: SecurityActorType.MACHINE,
    keys: ['route'],
  },
};

export type SecurityDetails = Readonly<Record<string, unknown>>;

export interface SecurityEventProps {
  id: string;
  /**
   * A quem o evento pertence. Nulo só em evento de máquina cujo client não
   * está cadastrado: não há organização a quem atribuí-lo.
   */
  organizationId: string | null;
  actor: SecurityActor;
  event: SecurityEventType;
  details: SecurityDetails;
  occurredAt: Date;
}

/**
 * Uma tentativa de acesso negada. Imutável: só é gravada e lida.
 *
 * As validações lançam Error comum: um evento mal formado é erro de
 * programação. Quem grava trata a falha (a negação responde do mesmo jeito).
 */
export class SecurityEvent {
  /** Teto de cada texto do details (operação, rota, chave, escopo). */
  static readonly MAX_DETAIL_LENGTH = 200;
  /** Teto da lista de escopos exigidos. */
  static readonly MAX_REQUIRED_SCOPES = 20;

  private constructor(private readonly props: SecurityEventProps) {}

  static create<E extends SecurityEventType>(
    input: {
      organizationId: string | null;
      actor: SecurityActor;
      event: E;
      details: SecurityDetailsByEvent[E];
    },
    occurredAt: Date,
  ): SecurityEvent {
    return SecurityEvent.restore({
      id: randomUUID(),
      ...input,
      occurredAt,
    });
  }

  static restore(props: SecurityEventProps): SecurityEvent {
    if (!props.id?.trim()) throw new Error('SecurityEvent sem id.');
    if (!isSecurityEventType(props.event)) {
      throw new Error(
        `SecurityEvent com evento desconhecido: ${String(props.event)}`,
      );
    }
    const shape = SHAPE[props.event];
    assertValidActor(props.actor, shape.actor, props.event);
    // Evento de usuário sempre tem organização: a negação aconteceu nela.
    if (
      props.organizationId === null
        ? shape.actor === SecurityActorType.USER
        : !props.organizationId?.trim()
    ) {
      throw new Error(`SecurityEvent ${props.event} sem organizationId.`);
    }
    assertValidDetails(props.details, shape.keys, props.event);

    return new SecurityEvent({
      ...props,
      actor: { ...props.actor },
      details: structuredClone(props.details),
    });
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string | null {
    return this.props.organizationId;
  }
  get actor(): SecurityActor {
    return this.props.actor;
  }
  get event(): SecurityEventType {
    return this.props.event;
  }
  get details(): SecurityDetails {
    return this.props.details;
  }
  get occurredAt(): Date {
    return this.props.occurredAt;
  }
}

function assertValidActor(
  actor: SecurityActor,
  expected: SecurityActorType,
  event: SecurityEventType,
): void {
  const valid =
    actor?.type === expected &&
    (actor.type === SecurityActorType.USER
      ? !!actor.userId?.trim()
      : !!actor.clientId?.trim());
  if (!valid) throw new Error(`SecurityEvent ${event} com ator inválido.`);
}

function assertValidDetails(
  details: SecurityDetails,
  keys: readonly string[],
  event: SecurityEventType,
): void {
  if (
    details === null ||
    typeof details !== 'object' ||
    Array.isArray(details)
  ) {
    throw new Error(`SecurityEvent ${event}: details precisa ser um objeto.`);
  }
  const actual = Object.keys(details).sort();
  if (actual.join() !== [...keys].sort().join()) {
    throw new Error(
      `SecurityEvent ${event}: details com as chaves [${actual.join(', ')}].`,
    );
  }
  // Só o nome do campo na mensagem: o conteúdo não vai para o log.
  for (const [key, value] of Object.entries(details)) {
    const texts = key === 'requiredScopes' ? value : [value];
    if (
      !Array.isArray(texts) ||
      texts.length > SecurityEvent.MAX_REQUIRED_SCOPES ||
      !texts.every(isValidText)
    ) {
      throw new Error(`SecurityEvent ${event}: details.${key} inválido.`);
    }
  }
}

function isValidText(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= SecurityEvent.MAX_DETAIL_LENGTH
  );
}
