import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthenticatedIdentity } from '@/modules/identity/application/ports/token-verifier.port';
import { JwtAuthGuard } from '@/modules/identity/presentation/auth/guards/jwt-auth.guard';
import { CurrentIdentity } from '@/modules/identity/presentation/auth/decorators/current-identity.decorator';
import { ListOrganizationPermissionsUseCase } from '@/modules/organizations/application/use-cases/list-organization-permissions.use-case';
import { CreatePermissionUseCase } from '@/modules/organizations/application/use-cases/create-permission.use-case';
import { UpdatePermissionUseCase } from '@/modules/organizations/application/use-cases/update-permission.use-case';
import { DeletePermissionUseCase } from '@/modules/organizations/application/use-cases/delete-permission.use-case';
import { CreatePermissionInput } from '../inputs/create-permission.input';
import { UpdatePermissionInput } from '../inputs/update-permission.input';
import { OrganizationPermissionType } from '../types/organization-permission.type';

@Resolver(() => OrganizationPermissionType)
@UseGuards(JwtAuthGuard)
export class PermissionsResolver {
  constructor(
    private readonly listOrganizationPermissionsUseCase: ListOrganizationPermissionsUseCase,
    private readonly createPermissionUseCase: CreatePermissionUseCase,
    private readonly updatePermissionUseCase: UpdatePermissionUseCase,
    private readonly deletePermissionUseCase: DeletePermissionUseCase,
  ) {}

  @Query(() => [OrganizationPermissionType], {
    description:
      'Catálogo efetivo da organização: as de sistema na ordem do catálogo, depois as personalizadas por chave. Exige roles:read.',
  })
  async organizationPermissions(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
  ): Promise<OrganizationPermissionType[]> {
    const permissions = await this.listOrganizationPermissionsUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
    });

    return permissions.map(OrganizationPermissionType.from);
  }

  @Mutation(() => OrganizationPermissionType, {
    description:
      'Cria uma permissão personalizada. Ninguém a recebe além do OWNER. Exige permissions:manage.',
  })
  async createPermission(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('input') input: CreatePermissionInput,
  ): Promise<OrganizationPermissionType> {
    const permission = await this.createPermissionUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      key: input.key,
      description: input.description,
    });

    return OrganizationPermissionType.from(permission);
  }

  @Mutation(() => OrganizationPermissionType, {
    description:
      'Troca a descrição de uma permissão personalizada. Exige permissions:manage.',
  })
  async updatePermission(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('input') input: UpdatePermissionInput,
  ): Promise<OrganizationPermissionType> {
    const permission = await this.updatePermissionUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      key: input.key,
      description: input.description,
    });

    return OrganizationPermissionType.from(permission);
  }

  @Mutation(() => Boolean, {
    description:
      'Exclui de vez uma permissão personalizada que nenhum papel concede. Exige permissions:manage.',
  })
  async deletePermission(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('key') key: string,
  ): Promise<boolean> {
    await this.deletePermissionUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      key,
    });

    return true;
  }
}
