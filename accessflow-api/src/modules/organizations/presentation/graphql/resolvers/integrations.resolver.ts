import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthenticatedIdentity } from '@/modules/identity/application/ports/token-verifier.port';
import { JwtAuthGuard } from '@/modules/identity/presentation/auth/guards/jwt-auth.guard';
import { CurrentIdentity } from '@/modules/identity/presentation/auth/decorators/current-identity.decorator';
import { ListIntegrationClientsUseCase } from '@/modules/organizations/application/use-cases/list-integration-clients.use-case';
import { CreateIntegrationClientUseCase } from '@/modules/organizations/application/use-cases/create-integration-client.use-case';
import { RevokeIntegrationClientUseCase } from '@/modules/organizations/application/use-cases/revoke-integration-client.use-case';
import { CreateIntegrationClientInput } from '../inputs/create-integration-client.input';
import {
  CreatedIntegrationClientType,
  IntegrationClientType,
} from '../types/integration-client.type';

@Resolver(() => IntegrationClientType)
@UseGuards(JwtAuthGuard)
export class IntegrationsResolver {
  constructor(
    private readonly listIntegrationClientsUseCase: ListIntegrationClientsUseCase,
    private readonly createIntegrationClientUseCase: CreateIntegrationClientUseCase,
    private readonly revokeIntegrationClientUseCase: RevokeIntegrationClientUseCase,
  ) {}

  @Query(() => [IntegrationClientType], {
    description:
      'Integrações da organização, em qualquer status, da mais nova à mais antiga. Exige integrations:read.',
  })
  async integrationClients(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
  ): Promise<IntegrationClientType[]> {
    const integrations = await this.listIntegrationClientsUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
    });

    return integrations.map(IntegrationClientType.from);
  }

  @Mutation(() => CreatedIntegrationClientType, {
    description:
      'Cria uma integração (app client de máquina no Cognito). O clientSecret aparece só nesta resposta. Até 5 em criação ou ativas por organização; só é possível conceder escopos cobertos pelas suas permissões. Exige integrations:manage.',
  })
  async createIntegrationClient(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('input') input: CreateIntegrationClientInput,
  ): Promise<CreatedIntegrationClientType> {
    const created = await this.createIntegrationClientUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      name: input.name,
      scopes: input.scopes,
    });

    const type = new CreatedIntegrationClientType();
    type.integration = IntegrationClientType.from(created.integration);
    type.clientSecret = created.clientSecret;
    return type;
  }

  @Mutation(() => Boolean, {
    description:
      'Revoga uma integração ativa: os tokens dela deixam de autorizar na hora, e o app client é apagado no Cognito. Já revogada: true, sem mudança. Exige integrations:manage.',
  })
  async revokeIntegrationClient(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('integrationId', { type: () => ID }) integrationId: string,
  ): Promise<boolean> {
    await this.revokeIntegrationClientUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      integrationId,
    });

    return true;
  }
}
