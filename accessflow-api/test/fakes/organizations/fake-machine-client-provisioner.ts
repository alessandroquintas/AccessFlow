import {
  MachineClientProvisioner,
  MachineClientSummary,
  ProvisionedMachineClient,
} from '@/modules/organizations/application/ports/machine-client-provisioner.port';
import { MachineScope } from '@/shared/domain/machine-scope';

/** Inconfundível: os testes de sigilo procuram este texto em logs e tabelas. */
export const FAKE_SECRET_MARKER = 'SEGREDO-FALSO-NUNCA-GRAVAR';

interface FakeClient {
  name: string;
  scopes: MachineScope[];
}

/** Cognito em memória. `failCreate`/`failDelete` simulam a AWS fora do ar. */
export class FakeMachineClientProvisioner extends MachineClientProvisioner {
  readonly clients = new Map<string, FakeClient>();
  readonly deleted: string[] = [];
  failCreate: Error | null = null;
  failDelete: Error | null = null;
  /** client_id da próxima criação (ex.: um já gravado, para o passo 3 falhar). */
  nextClientId: string | null = null;
  /** Chamado depois de criar, antes de devolver. */
  afterCreate: (() => Promise<void>) | null = null;
  private sequence = 0;

  reset(): void {
    this.clients.clear();
    this.deleted.length = 0;
    this.failCreate = null;
    this.failDelete = null;
    this.nextClientId = null;
    this.afterCreate = null;
  }

  /** Um client criado por fora (ex.: deixado por uma falha anterior). */
  seed(clientId: string, name: string, scopes: MachineScope[] = []): void {
    this.clients.set(clientId, { name, scopes });
  }

  static secretOf(clientId: string): string {
    return `${FAKE_SECRET_MARKER}-${clientId}`;
  }

  async create(input: {
    name: string;
    scopes: readonly MachineScope[];
  }): Promise<ProvisionedMachineClient> {
    if (this.failCreate) throw this.failCreate;
    this.sequence++;
    const clientId =
      this.nextClientId ??
      `fakeclient${String(this.sequence).padStart(6, '0')}`;
    this.nextClientId = null;
    this.clients.set(clientId, { name: input.name, scopes: [...input.scopes] });
    await this.afterCreate?.();
    return {
      clientId,
      clientSecret: FakeMachineClientProvisioner.secretOf(clientId),
    };
  }

  async delete(clientId: string): Promise<void> {
    if (this.failDelete) throw this.failDelete;
    this.clients.delete(clientId);
    this.deleted.push(clientId);
  }

  async listByPrefix(prefix: string): Promise<MachineClientSummary[]> {
    if (!prefix) throw new Error('listByPrefix exige um prefixo.');
    return [...this.clients.entries()]
      .filter(([, client]) => client.name.startsWith(prefix))
      .map(([clientId, { name }]) => ({ clientId, name }));
  }
}
