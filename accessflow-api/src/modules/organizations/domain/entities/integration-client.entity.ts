import { randomUUID } from 'node:crypto';
import { restoreFromStorage } from '@/shared/domain/restore-from-storage';
import {
  isMachineScope,
  MachineScope,
  sortMachineScopes,
} from '@/shared/domain/machine-scope';
import { InvalidIntegrationClientError } from '../errors/invalid-integration-client.error';
import { IntegrationNotActiveError } from '../errors/integration-not-active.error';
import { IntegrationName } from '../value-objects/integration-name.vo';

/**
 * - PROVISIONING: gravada, à espera do app client no Cognito.
 * - ACTIVE: com app client; a única que autoriza.
 * - REVOKED: revogada; o app client é apagado depois.
 * - FAILED: o app client não chegou a existir (ou foi compensado).
 */
export const IntegrationClientStatus = {
  PROVISIONING: 'PROVISIONING',
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  FAILED: 'FAILED',
} as const;

export type IntegrationClientStatus =
  (typeof IntegrationClientStatus)[keyof typeof IntegrationClientStatus];

/** Status que têm app client no Cognito, e portanto clientId. */
const WITH_CLIENT: ReadonlySet<IntegrationClientStatus> = new Set([
  IntegrationClientStatus.ACTIVE,
  IntegrationClientStatus.REVOKED,
]);

export interface IntegrationClientProps {
  id: string;
  organizationId: string;
  /**
   * App client do Cognito (claim `client_id` do token de máquina). Nulo
   * enquanto PROVISIONING e em FAILED.
   */
  clientId: string | null;
  name: string;
  /** Do catálogo de máquina, ao menos um, sem repetição, na ordem dele. */
  scopes: readonly MachineScope[];
  status: IntegrationClientStatus;
  /** Nulo nas integrações anteriores ao painel (ex.: a demo do Terraform). */
  createdByUserId: string | null;
  revokedAt: Date | null;
  /** Nulo se revogada antes do painel. */
  revokedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Sistema externo autorizado a consultar uma única organização. */
export class IntegrationClient {
  /** Integrações que ocupam vaga: em criação ou ativas. */
  static readonly MAX_LIVE_PER_ORGANIZATION = 5;

  private constructor(private props: IntegrationClientProps) {}

  /**
   * Integração nova, ainda sem app client (PROVISIONING). Escopos repetidos
   * são descartados; fora do catálogo de máquina é erro.
   */
  static create(
    input: {
      organizationId: string;
      name: string;
      scopes: readonly string[];
      createdByUserId: string;
    },
    now: Date,
  ): IntegrationClient {
    return IntegrationClient.build({
      id: randomUUID(),
      organizationId: input.organizationId,
      clientId: null,
      name: IntegrationName.create(input.name).value,
      scopes: parseScopes(input.scopes),
      status: IntegrationClientStatus.PROVISIONING,
      createdByUserId: input.createdByUserId,
      revokedAt: null,
      revokedByUserId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * A partir do banco. Dado que não passa nas regras é corrupção: Error
   * comum (500), e não DomainError (400).
   */
  static restore(props: IntegrationClientProps): IntegrationClient {
    return restoreFromStorage('IntegrationClient', () =>
      IntegrationClient.build(props),
    );
  }

  /** As regras da entidade; falha com DomainError. */
  private static build(props: IntegrationClientProps): IntegrationClient {
    const { id, organizationId, clientId, status, revokedAt } = props;

    if (!id?.trim()) {
      throw new InvalidIntegrationClientError('id é obrigatório.');
    }
    if (!organizationId?.trim()) {
      throw new InvalidIntegrationClientError('organizationId é obrigatório.');
    }
    if (!Object.values(IntegrationClientStatus).includes(status)) {
      throw new InvalidIntegrationClientError('status desconhecido.');
    }
    if (WITH_CLIENT.has(status) !== !!clientId?.trim()) {
      throw new InvalidIntegrationClientError(
        `clientId é obrigatório em ACTIVE e REVOKED, e ausente nos demais (${status}).`,
      );
    }
    if ((status === IntegrationClientStatus.REVOKED) !== (revokedAt !== null)) {
      throw new InvalidIntegrationClientError(
        'revokedAt existe só em REVOKED.',
      );
    }
    if (
      props.revokedByUserId !== null &&
      status !== IntegrationClientStatus.REVOKED
    ) {
      throw new InvalidIntegrationClientError(
        'revokedByUserId existe só em REVOKED.',
      );
    }
    const scopes = parseScopes(props.scopes);
    if (scopes.length !== props.scopes.length) {
      throw new InvalidIntegrationClientError('scopes com repetição.');
    }

    return new IntegrationClient({
      ...props,
      name: IntegrationName.create(props.name).value,
      scopes,
    });
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get clientId(): string | null {
    return this.props.clientId;
  }
  get name(): string {
    return this.props.name;
  }
  get scopes(): readonly MachineScope[] {
    return this.props.scopes;
  }
  get status(): IntegrationClientStatus {
    return this.props.status;
  }
  get createdByUserId(): string | null {
    return this.props.createdByUserId;
  }
  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }
  get revokedByUserId(): string | null {
    return this.props.revokedByUserId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Só ACTIVE autoriza; as demais respondem como "sem vínculo". */
  isActive(): boolean {
    return this.props.status === IntegrationClientStatus.ACTIVE;
  }

  /** Ocupa uma das vagas da organização: em criação ou ativa. */
  isLive(): boolean {
    return (
      this.props.status === IntegrationClientStatus.PROVISIONING ||
      this.props.status === IntegrationClientStatus.ACTIVE
    );
  }

  /** O app client foi criado no Cognito. Só a partir de PROVISIONING. */
  activate(clientId: string, now: Date): void {
    this.expect(IntegrationClientStatus.PROVISIONING, 'ativar');
    if (!clientId?.trim()) throw new Error('activate sem clientId.');
    this.props = {
      ...this.props,
      clientId,
      status: IntegrationClientStatus.ACTIVE,
      updatedAt: now,
    };
  }

  /** O app client não chegou a existir. Só a partir de PROVISIONING. */
  fail(now: Date): void {
    this.expect(IntegrationClientStatus.PROVISIONING, 'marcar a falha de');
    this.props = {
      ...this.props,
      status: IntegrationClientStatus.FAILED,
      updatedAt: now,
    };
  }

  /**
   * Revoga uma integração ativa. Já revogada: nada muda e devolve false
   * (idempotente). Em criação ou com falha: IntegrationNotActiveError.
   */
  revoke(byUserId: string, now: Date): boolean {
    if (this.props.status === IntegrationClientStatus.REVOKED) return false;
    if (this.props.status !== IntegrationClientStatus.ACTIVE) {
      throw new IntegrationNotActiveError();
    }
    this.props = {
      ...this.props,
      status: IntegrationClientStatus.REVOKED,
      revokedAt: now,
      revokedByUserId: byUserId,
      updatedAt: now,
    };
    return true;
  }

  /** Transições do fluxo de criação: fora de ordem é erro de programação. */
  private expect(status: IntegrationClientStatus, action: string): void {
    if (this.props.status !== status) {
      throw new Error(
        `Não dá para ${action} uma integração ${this.props.status}.`,
      );
    }
  }
}

/** Ao menos um, do catálogo de máquina; sem repetição, na ordem dele. */
function parseScopes(raw: readonly string[]): MachineScope[] {
  const scopes = [...new Set(raw ?? [])];
  if (scopes.length === 0) {
    throw new InvalidIntegrationClientError(
      'scopes deve ter ao menos um item.',
    );
  }
  for (const scope of scopes) {
    if (!isMachineScope(scope)) {
      throw new InvalidIntegrationClientError(
        `Escopo fora do catálogo de máquina: "${scope}".`,
      );
    }
  }
  return sortMachineScopes(scopes as MachineScope[]);
}
