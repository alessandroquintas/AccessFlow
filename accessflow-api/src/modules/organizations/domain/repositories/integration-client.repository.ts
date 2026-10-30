import { IntegrationClient } from '../entities/integration-client.entity';

export abstract class IntegrationClientRepository {
  /** Pelo app client do Cognito, em qualquer status. */
  abstract findByClientId(clientId: string): Promise<IntegrationClient | null>;

  /** Da organização informada; de outra, null. */
  abstract findById(
    organizationId: string,
    id: string,
  ): Promise<IntegrationClient | null>;

  /** Todas as da organização, em qualquer status, da mais nova à mais antiga. */
  abstract listByOrganization(
    organizationId: string,
  ): Promise<IntegrationClient[]>;

  /**
   * As que ocupam vaga (PROVISIONING e ACTIVE). Para o limite valer, chamar
   * na transação, depois de travar a organização.
   */
  abstract countLiveByOrganization(organizationId: string): Promise<number>;

  /**
   * As em PROVISIONING de todas as organizações, da mais antiga à mais nova.
   * Só para a reconciliação.
   */
  abstract listProvisioning(): Promise<IntegrationClient[]>;

  abstract create(client: IntegrationClient): Promise<void>;

  /** Grava as mudanças de status (activate, fail, revoke). */
  abstract save(client: IntegrationClient): Promise<void>;
}
