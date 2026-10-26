import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthenticatedIdentity } from '@/modules/identity/application/ports/token-verifier.port';
import { JwtAuthGuard } from '@/modules/identity/presentation/auth/guards/jwt-auth.guard';
import { CurrentIdentity } from '@/modules/identity/presentation/auth/decorators/current-identity.decorator';
import { ListMyOrganizationsUseCase } from '@/modules/organizations/application/use-cases/list-my-organizations.use-case';
import { GetOrganizationUseCase } from '@/modules/organizations/application/use-cases/get-organization.use-case';

import { CreateOrganizationInput } from '../inputs/create-organization.input';
import { OrganizationType } from '../types/organization.type';
import { CreateOrganizationUseCase } from '@/modules/organizations/application/use-cases/create-organization.use-case';
import { UpdateOrganizationUseCase } from '@/modules/organizations/application/use-cases/update-organization.use-case';
import { UpdateOrganizationInput } from '../inputs/update-organization.input';

@Resolver(() => OrganizationType)
@UseGuards(JwtAuthGuard)
export class OrganizationsResolver {
  constructor(
    private readonly createOrganizationUseCase: CreateOrganizationUseCase,
    private readonly listMyOrganizationsUseCase: ListMyOrganizationsUseCase,
    private readonly getOrganizationUseCase: GetOrganizationUseCase,
    private readonly updateOrganizationUseCase: UpdateOrganizationUseCase,
  ) {}

  @Mutation(() => OrganizationType, {
    description: 'Cria uma organização. O usuário autenticado se torna OWNER.',
  })
  async createOrganization(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('input') input: CreateOrganizationInput,
  ): Promise<OrganizationType> {
    const result = await this.createOrganizationUseCase.execute({
      cognitoSub: identity.sub,
      name: input.name,
      slug: input.slug,
    });
    return OrganizationType.from(result);
  }

  @Query(() => [OrganizationType], {
    description: 'Organizações das quais o usuário autenticado é membro ativo.',
  })
  async myOrganizations(
    @CurrentIdentity() identity: AuthenticatedIdentity,
  ): Promise<OrganizationType[]> {
    const results = await this.listMyOrganizationsUseCase.execute(identity.sub);
    return results.map(OrganizationType.from);
  }

  @Query(() => OrganizationType, {
    description: 'Uma organização da qual o usuário autenticado é membro.',
  })
  async organization(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
  ): Promise<OrganizationType> {
    const result = await this.getOrganizationUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
    });
    return OrganizationType.from(result);
  }

  @Mutation(() => OrganizationType, {
    description: 'Atualiza os dados da organização. ',
  })
  async updateOrganization(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('input') input: UpdateOrganizationInput,
  ): Promise<OrganizationType> {
    const result = await this.updateOrganizationUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      name: input.name,
    });

    return OrganizationType.from(result);
  }
}
