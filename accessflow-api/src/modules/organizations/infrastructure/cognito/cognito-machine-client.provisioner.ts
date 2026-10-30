import {
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  DeleteUserPoolClientCommand,
  ListUserPoolClientsCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import { MachineScope } from '@/shared/domain/machine-scope';
import {
  MachineClientProvisioner,
  MachineClientSummary,
  ProvisionedMachineClient,
} from '@/modules/organizations/application/ports/machine-client-provisioner.port';

/** O que o adaptador usa do client do SDK; os testes passam um fake. */
export type CognitoClient = Pick<CognitoIdentityProviderClient, 'send'>;

/** Máximo que o ListUserPoolClients aceita por página. */
const LIST_PAGE_SIZE = 60;

/**
 * App clients de máquina no user pool, com a mesma configuração do
 * `integration_demo` do Terraform (infra/permanent/cognito.tf).
 *
 * Permissões IAM, no ARN do pool: cognito-idp:CreateUserPoolClient,
 * cognito-idp:DeleteUserPoolClient e cognito-idp:ListUserPoolClients.
 */
export class CognitoMachineClientProvisioner extends MachineClientProvisioner {
  constructor(
    private readonly client: CognitoClient,
    private readonly userPoolId: string,
  ) {
    super();
  }

  static fromUserPoolId(userPoolId: string): CognitoMachineClientProvisioner {
    const region = userPoolId.split('_')[0];

    return new CognitoMachineClientProvisioner(
      new CognitoIdentityProviderClient({
        region,
        // Sem prazo, uma chamada travada seguraria a criação (e a linha em
        // PROVISIONING) indefinidamente.
        requestHandler: { connectionTimeout: 3_000, requestTimeout: 10_000 },
      }),
      userPoolId,
    );
  }

  async create(input: {
    name: string;
    scopes: readonly MachineScope[];
  }): Promise<ProvisionedMachineClient> {
    const output = await this.client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: this.userPoolId,
        ClientName: input.name,
        GenerateSecret: true,
        AllowedOAuthFlowsUserPoolClient: true,
        AllowedOAuthFlows: ['client_credentials'],
        // Escopos explícitos: um escopo novo no resource server não é
        // concedido sozinho às integrações existentes.
        AllowedOAuthScopes: [...input.scopes],
        // Sem a lista, o Cognito habilita SRP e CUSTOM_AUTH. O client
        // credentials não emite refresh token: este fluxo fica inerte.
        ExplicitAuthFlows: ['ALLOW_REFRESH_TOKEN_AUTH'],
        PreventUserExistenceErrors: 'ENABLED',
        EnableTokenRevocation: true,
        AccessTokenValidity: 60,
        TokenValidityUnits: { AccessToken: 'minutes' },
      }),
    );

    const clientId = output.UserPoolClient?.ClientId;
    const clientSecret = output.UserPoolClient?.ClientSecret;
    if (!clientId || !clientSecret) {
      // Sem o segredo o client é inútil; se ele existir, fica para a
      // reconciliação.
      throw new Error('CreateUserPoolClient não devolveu client_id e secret.');
    }
    return { clientId, clientSecret };
  }

  async delete(clientId: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteUserPoolClientCommand({
          UserPoolId: this.userPoolId,
          ClientId: clientId,
        }),
      );
    } catch (error) {
      if (error instanceof ResourceNotFoundException) return;
      throw error;
    }
  }

  async listByPrefix(prefix: string): Promise<MachineClientSummary[]> {
    // Prefixo vazio listaria todos os clients do pool, inclusive os de usuário.
    if (!prefix) throw new Error('listByPrefix exige um prefixo.');

    const found: MachineClientSummary[] = [];
    let nextToken: string | undefined;
    do {
      const page = await this.client.send(
        new ListUserPoolClientsCommand({
          UserPoolId: this.userPoolId,
          MaxResults: LIST_PAGE_SIZE,
          NextToken: nextToken,
        }),
      );
      for (const { ClientId, ClientName } of page.UserPoolClients ?? []) {
        if (ClientId && ClientName?.startsWith(prefix)) {
          found.push({ clientId: ClientId, name: ClientName });
        }
      }
      nextToken = page.NextToken;
    } while (nextToken);
    return found;
  }
}
