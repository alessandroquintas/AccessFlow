import { beforeEach, describe, expect, it } from 'vitest';
import {
  CreateUserPoolClientCommand,
  DeleteUserPoolClientCommand,
  InternalErrorException,
  ListUserPoolClientsCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoMachineClientProvisioner } from '@/modules/organizations/infrastructure/cognito/cognito-machine-client.provisioner';
import { MachineScope } from '@/shared/domain/machine-scope';

const USER_POOL_ID = 'us-east-1_TestPool1';

/** Client do SDK falso: guarda os comandos e responde o que o teste mandar. */
class FakeCognitoClient {
  readonly commands: unknown[] = [];
  responses: unknown[] = [];

  async send(command: unknown): Promise<unknown> {
    this.commands.push(command);
    const response = this.responses.shift();
    if (response instanceof Error) throw response;
    return response ?? {};
  }
}

let cognito: FakeCognitoClient;
let sut: CognitoMachineClientProvisioner;

function notFound() {
  return new ResourceNotFoundException({
    message: 'User pool client does not exist.',
    $metadata: {},
  });
}

describe('CognitoMachineClientProvisioner', () => {
  beforeEach(() => {
    cognito = new FakeCognitoClient();
    sut = new CognitoMachineClientProvisioner(cognito, USER_POOL_ID);
  });

  describe('create', () => {
    it('cria como o integration_demo: client credentials, segredo, escopos explícitos, 60 minutos, revogação', async () => {
      cognito.responses = [
        { UserPoolClient: { ClientId: 'abc123', ClientSecret: 's3cr3t' } },
      ];

      const created = await sut.create({
        name: 'accessflow-int-0001',
        scopes: [MachineScope.MEMBERS_READ],
      });

      expect(created).toEqual({ clientId: 'abc123', clientSecret: 's3cr3t' });
      const [command] = cognito.commands;
      expect(command).toBeInstanceOf(CreateUserPoolClientCommand);
      expect((command as CreateUserPoolClientCommand).input).toEqual({
        UserPoolId: USER_POOL_ID,
        ClientName: 'accessflow-int-0001',
        GenerateSecret: true,
        AllowedOAuthFlowsUserPoolClient: true,
        AllowedOAuthFlows: ['client_credentials'],
        AllowedOAuthScopes: ['accessflow-api/members.read'],
        ExplicitAuthFlows: ['ALLOW_REFRESH_TOKEN_AUTH'],
        PreventUserExistenceErrors: 'ENABLED',
        EnableTokenRevocation: true,
        AccessTokenValidity: 60,
        TokenValidityUnits: { AccessToken: 'minutes' },
      });
    });

    it('sem nenhum fluxo de usuário', async () => {
      cognito.responses = [
        { UserPoolClient: { ClientId: 'abc123', ClientSecret: 's3cr3t' } },
      ];

      await sut.create({ name: 'x', scopes: Object.values(MachineScope) });

      const { input } = cognito.commands[0] as CreateUserPoolClientCommand;
      expect(input.AllowedOAuthFlows).toEqual(['client_credentials']);
      expect(input.ExplicitAuthFlows).toEqual(['ALLOW_REFRESH_TOKEN_AUTH']);
      expect(input.CallbackURLs).toBeUndefined();
      expect(input.SupportedIdentityProviders).toBeUndefined();
    });

    it('resposta sem client_id ou sem segredo: erro, sem repetir o que veio', async () => {
      cognito.responses = [
        { UserPoolClient: { ClientId: 'abc123' } },
        { UserPoolClient: { ClientSecret: 'nao-pode-vazar' } },
      ];

      await expect(
        sut.create({ name: 'x', scopes: [MachineScope.AUTHORIZE] }),
      ).rejects.toThrow(
        'CreateUserPoolClient não devolveu client_id e secret.',
      );
      const error = await sut
        .create({ name: 'x', scopes: [MachineScope.AUTHORIZE] })
        .catch((e: Error) => e);
      expect(String(error)).not.toContain('nao-pode-vazar');
    });

    it('erro do Cognito sobe como veio', async () => {
      cognito.responses = [
        new InternalErrorException({ message: 'boom', $metadata: {} }),
      ];

      await expect(
        sut.create({ name: 'x', scopes: [MachineScope.AUTHORIZE] }),
      ).rejects.toBeInstanceOf(InternalErrorException);
    });
  });

  describe('delete', () => {
    it('apaga o client do pool', async () => {
      await sut.delete('abc123');

      const [command] = cognito.commands;
      expect(command).toBeInstanceOf(DeleteUserPoolClientCommand);
      expect((command as DeleteUserPoolClientCommand).input).toEqual({
        UserPoolId: USER_POOL_ID,
        ClientId: 'abc123',
      });
    });

    it('client que já não existe: não é erro (idempotente)', async () => {
      cognito.responses = [notFound()];

      await expect(sut.delete('abc123')).resolves.toBeUndefined();
    });

    it('outros erros sobem', async () => {
      cognito.responses = [
        new InternalErrorException({ message: 'boom', $metadata: {} }),
      ];

      await expect(sut.delete('abc123')).rejects.toBeInstanceOf(
        InternalErrorException,
      );
    });
  });

  describe('listByPrefix', () => {
    it('percorre todas as páginas e devolve só os do prefixo', async () => {
      cognito.responses = [
        {
          UserPoolClients: [
            { ClientId: 'web', ClientName: 'accessflow-web' },
            { ClientId: 'i1', ClientName: 'accessflow-int-aaa' },
          ],
          NextToken: 'pagina-2',
        },
        {
          UserPoolClients: [
            { ClientId: 'demo', ClientName: 'accessflow-integration-demo' },
            { ClientId: 'i2', ClientName: 'accessflow-int-bbb' },
            { ClientId: 'sem-nome' },
          ],
        },
      ];

      const found = await sut.listByPrefix('accessflow-int-');

      expect(found).toEqual([
        { clientId: 'i1', name: 'accessflow-int-aaa' },
        { clientId: 'i2', name: 'accessflow-int-bbb' },
      ]);
      const inputs = cognito.commands.map((command) => {
        expect(command).toBeInstanceOf(ListUserPoolClientsCommand);
        return (command as ListUserPoolClientsCommand).input;
      });
      expect(inputs).toEqual([
        { UserPoolId: USER_POOL_ID, MaxResults: 60, NextToken: undefined },
        { UserPoolId: USER_POOL_ID, MaxResults: 60, NextToken: 'pagina-2' },
      ]);
    });

    it('prefixo vazio: recusa sem chamar o Cognito', async () => {
      await expect(sut.listByPrefix('')).rejects.toThrow(
        'listByPrefix exige um prefixo.',
      );
      expect(cognito.commands).toEqual([]);
    });
  });

  it('fromUserPoolId usa a região do pool', async () => {
    const provisioner =
      CognitoMachineClientProvisioner.fromUserPoolId('sa-east-1_Abc123');
    const client = (provisioner as unknown as { client: { config: any } })
      .client;

    expect(await client.config.region()).toBe('sa-east-1');
  });
});
