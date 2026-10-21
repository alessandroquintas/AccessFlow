import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthenticatedIdentity } from '@/modules/identity/application/ports/token-verifier.port';
import { JwtAuthGuard } from '@/modules/identity/presentation/graphql/guards/jwt-auth.guard';
import { CurrentIdentity } from '@/modules/identity/presentation/graphql/decorators/current-identity.decorator';
import { ListMyOrganizationsUseCase } from '@/modules/organizations/application/use-cases/list-my-organizations.use-case';
import { GetOrganizationUseCase } from '@/modules/organizations/application/use-cases/get-organization.use-case';

import { CreateOrganizationInput } from '../inputs/create-organization.input';
import { OrganizationTypes } from '../types/organization.type';
import { CreateOrganizationUseCase } from '@/modules/organizations/application/use-cases/create-organization.use.case';

@Resolver(() => OrganizationTypes)
@UseGuards(JwtAuthGuard)
export class OrganizationsResolver {
  constructor(
    private readonly createOrganizationUseCase: CreateOrganizationUseCase,
    private readonly listMyOrganizationsUseCase: ListMyOrganizationsUseCase,
    private readonly getOrganizationUseCase: GetOrganizationUseCase,
  ) {}

  @Mutation(() => OrganizationTypes, {
    description: 'Cria uma organização. O usuário autenticado se torna OWNER.',
  })
  async createOrganization(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('input') input: CreateOrganizationInput,
  ): Promise<OrganizationTypes> {
    const result = await this.createOrganizationUseCase.execute({
      cognitoSub: identity.sub,
      name: input.name,
      slug: input.slug,
    });
    return OrganizationTypes.from(result);
  }

  @Query(() => [OrganizationTypes], {
    description: 'Organizações das quais o usuário autenticado é membro ativo.',
  })
  async myOrganizations(
    @CurrentIdentity() identity: AuthenticatedIdentity,
  ): Promise<OrganizationTypes[]> {
    const results = await this.listMyOrganizationsUseCase.execute(identity.sub);
    return results.map(OrganizationTypes.from);
  }

  @Query(() => OrganizationTypes, {
    description: 'Uma organização da qual o usuário autenticado é membro.',
  })
  async organization(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
  ): Promise<OrganizationTypes> {
    const result = await this.getOrganizationUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
    });
    return OrganizationTypes.from(result);
  }
}
