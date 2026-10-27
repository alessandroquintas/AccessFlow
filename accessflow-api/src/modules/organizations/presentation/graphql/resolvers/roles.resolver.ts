import { UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type { AuthenticatedIdentity } from '@/modules/identity/application/ports/token-verifier.port';
import { JwtAuthGuard } from '@/modules/identity/presentation/auth/guards/jwt-auth.guard';
import { CurrentIdentity } from '@/modules/identity/presentation/auth/decorators/current-identity.decorator';
import { ListOrganizationRolesUseCase } from '@/modules/organizations/application/use-cases/list-organization-roles.use-case';
import { GetMyPermissionsUseCase } from '@/modules/organizations/application/use-cases/get-my-permissions.use-case';
import { CreateRoleUseCase } from '@/modules/organizations/application/use-cases/create-role.use-case';
import { UpdateRoleUseCase } from '@/modules/organizations/application/use-cases/update-role.use-case';
import { DeleteRoleUseCase } from '@/modules/organizations/application/use-cases/delete-role.use-case';
import { AssignRoleUseCase } from '@/modules/organizations/application/use-cases/assign-role.use-case';
import { CountMembersByRoleUseCase } from '@/modules/organizations/application/use-cases/count-members-by-role.use-case';
import { PERMISSION_CATALOG } from '@/modules/organizations/policies/organization-permission';
import { CreateRoleInput } from '../inputs/create-role.input';
import { UpdateRoleInput } from '../inputs/update-role.input';
import { AssignRoleInput } from '../inputs/assign-role.input';
import { OrganizationRoleType } from '../types/organization-role.type';
import { PermissionDefinitionType } from '../types/permission-definition.type';
import { OrganizationMemberType } from '../types/organization-member.type';

/** Contagens por organização, guardadas só durante uma requisição. */
type MemberCountsByOrganization = Map<string, Promise<Map<string, number>>>;

@Resolver(() => OrganizationRoleType)
@UseGuards(JwtAuthGuard)
export class RolesResolver {
  // Chave: o contexto GraphQL, novo a cada requisição.
  private readonly memberCounts = new WeakMap<
    object,
    MemberCountsByOrganization
  >();

  constructor(
    private readonly listOrganizationRolesUseCase: ListOrganizationRolesUseCase,
    private readonly getMyPermissionsUseCase: GetMyPermissionsUseCase,
    private readonly createRoleUseCase: CreateRoleUseCase,
    private readonly updateRoleUseCase: UpdateRoleUseCase,
    private readonly deleteRoleUseCase: DeleteRoleUseCase,
    private readonly assignRoleUseCase: AssignRoleUseCase,
    private readonly countMembersByRoleUseCase: CountMembersByRoleUseCase,
  ) {}

  @Query(() => [OrganizationRoleType], {
    description:
      'Papéis da organização, sem os apagados: os de sistema primeiro, depois por nome. Exige roles:read.',
  })
  async organizationRoles(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
  ): Promise<OrganizationRoleType[]> {
    const roles = await this.listOrganizationRolesUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
    });

    return roles.map(OrganizationRoleType.fromOrganizationRole);
  }

  @Query(() => [PermissionDefinitionType], {
    description: 'Catálogo das permissões que um papel pode ter.',
  })
  permissionCatalog(): PermissionDefinitionType[] {
    return PERMISSION_CATALOG.map(PermissionDefinitionType.from);
  }

  @Query(() => [String], {
    description:
      'Permissões efetivas do usuário autenticado na organização; o OWNER recebe o catálogo inteiro.',
  })
  myPermissions(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
  ): Promise<readonly string[]> {
    return this.getMyPermissionsUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
    });
  }

  @Mutation(() => OrganizationRoleType, {
    description: 'Cria um papel personalizado. Exige roles:manage.',
  })
  async createRole(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('input') input: CreateRoleInput,
  ): Promise<OrganizationRoleType> {
    const role = await this.createRoleUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      name: input.name,
      permissions: input.permissions,
    });

    return OrganizationRoleType.fromOrganizationRole(role);
  }

  @Mutation(() => OrganizationRoleType, {
    description:
      'Renomeia um papel ou troca as permissões dele. O OWNER não muda; o MEMBER só muda as permissões. Exige roles:manage.',
  })
  async updateRole(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('input') input: UpdateRoleInput,
  ): Promise<OrganizationRoleType> {
    const role = await this.updateRoleUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      roleId: input.roleId,
      name: input.name ?? undefined,
      permissions: input.permissions ?? undefined,
    });

    return OrganizationRoleType.fromOrganizationRole(role);
  }

  @Mutation(() => Boolean, {
    description:
      'Apaga um papel personalizado sem membros ativos nem convites pendentes. Exige roles:manage.',
  })
  async deleteRole(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('roleId', { type: () => ID }) roleId: string,
  ): Promise<boolean> {
    await this.deleteRoleUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      roleId,
    });

    return true;
  }

  @Mutation(() => OrganizationMemberType, {
    description:
      'Troca o papel de um membro. Só é possível atribuir e tirar papéis cujas permissões você tem. Exige roles:assign.',
  })
  async assignRole(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('organizationId', { type: () => ID }) organizationId: string,
    @Args('input') input: AssignRoleInput,
  ): Promise<OrganizationMemberType> {
    const member = await this.assignRoleUseCase.execute({
      cognitoSub: identity.sub,
      organizationId,
      userId: input.userId,
      roleId: input.roleId,
    });

    return OrganizationMemberType.from(member);
  }

  /**
   * Pronto quando o caso de uso já contou (organizationRoles, createRole,
   * updateRole); senão, uma consulta por organização e requisição,
   * compartilhada por todos os papéis dela (ex.: os viewerAssignedRole de
   * myOrganizations).
   */
  @ResolveField(() => Int, { description: 'Membros ativos com o papel.' })
  async memberCount(
    @Parent() role: OrganizationRoleType,
    @Context() context: object,
  ): Promise<number> {
    if (role.knownMemberCount !== undefined) return role.knownMemberCount;

    let byOrganization = this.memberCounts.get(context);
    if (!byOrganization) {
      byOrganization = new Map();
      this.memberCounts.set(context, byOrganization);
    }

    let counts = byOrganization.get(role.organizationId);
    if (!counts) {
      counts = this.countMembersByRoleUseCase.execute(role.organizationId);
      byOrganization.set(role.organizationId, counts);
    }

    return (await counts).get(role.id) ?? 0;
  }
}
