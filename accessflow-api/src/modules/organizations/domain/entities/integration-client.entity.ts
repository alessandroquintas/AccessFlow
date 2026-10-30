import { restoreFromStorage } from '@/shared/domain/restore-from-storage';
import { InvalidIntegrationClientError } from '../errors/invalid-integration-client.error';

export const IntegrationClientStatus = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
} as const;

export type IntegrationClientStatus =
  (typeof IntegrationClientStatus)[keyof typeof IntegrationClientStatus];

export interface IntegrationClientProps {
  id: string;
  /** App client do Cognito (claim `client_id` do token de máquina). */
  clientId: string;
  organizationId: string;
  name: string;
  status: IntegrationClientStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Sistema externo autorizado a consultar uma única organização. */
export class IntegrationClient {
  private constructor(private readonly props: IntegrationClientProps) {}

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
    const { id, clientId, organizationId } = props;

    if (!id?.trim()) {
      throw new InvalidIntegrationClientError('id é obrigatório.');
    }

    if (!clientId?.trim()) {
      throw new InvalidIntegrationClientError('clientId é obrigatório.');
    }

    if (!organizationId?.trim()) {
      throw new InvalidIntegrationClientError('organizationId é obrigatório.');
    }

    return new IntegrationClient({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get clientId(): string {
    return this.props.clientId;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get name(): string {
    return this.props.name;
  }
  get status(): IntegrationClientStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isActive(): boolean {
    return this.props.status === IntegrationClientStatus.ACTIVE;
  }
}
