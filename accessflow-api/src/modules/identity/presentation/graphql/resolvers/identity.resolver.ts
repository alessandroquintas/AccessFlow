import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthenticatedIdentity } from '@/modules/identity/application/ports/token-verifier.port';
import { GetCurrentUserUseCase } from '@/modules/identity/application/use-cases/get-current-user.use-case';
import { UserType } from '../types/user.type';
import { JwtAuthGuard } from '@/modules/identity/presentation/auth/guards/jwt-auth.guard';
import { CurrentIdentity } from '@/modules/identity/presentation/auth/decorators/current-identity.decorator';
import { ProvisionUserUseCase } from '@/modules/identity/application/use-cases/provision-user.use-case';
import { CurrentAccessToken } from '@/modules/identity/presentation/auth/decorators/current-access-token.decorator';
import { ProvisionMeInput } from '../inputs/provision-me.input';
import { UpdateMyProfileUseCase } from '@/modules/identity/application/use-cases/update-my-profile.use-case';
import { UpdateMyProfileInput } from '../inputs/update-my-profile.input';

@Resolver(() => UserType)
export class IdentityResolver {
  constructor(
    private readonly getCurrentUser: GetCurrentUserUseCase,
    private readonly provisionUser: ProvisionUserUseCase,
    private readonly updateProfile: UpdateMyProfileUseCase,
  ) {}

  @Query(() => UserType, { description: 'Perfil do usuário autenticado.' })
  @UseGuards(JwtAuthGuard)
  async me(
    @CurrentIdentity() identity: AuthenticatedIdentity,
  ): Promise<UserType> {
    const user = await this.getCurrentUser.execute(identity.sub);
    return UserType.fromDomain(user);
  }

  @Mutation(() => UserType, {
    description:
      'Cria o perfil local do usuário autenticado. Se já existir, devolve o existente',
  })
  @UseGuards(JwtAuthGuard)
  async provisionMe(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @CurrentAccessToken() accessToken: string,
    @Args('input') input: ProvisionMeInput,
  ): Promise<UserType> {
    const user = await this.provisionUser.execute({
      cognitoSub: identity.sub,
      accessToken,
      name: input.name,
    });
    return UserType.fromDomain(user);
  }

  @Mutation(() => UserType, {
    description:
      'Atualiza o perfil do usuário autenticado. O e-mail vem do Cognito e não é editável.',
  })
  @UseGuards(JwtAuthGuard)
  async updateMyProfile(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Args('input') input: UpdateMyProfileInput,
  ): Promise<UserType> {
    const user = await this.updateProfile.execute({
      cognitoSub: identity.sub,
      name: input.name,
    });
    return UserType.fromDomain(user);
  }
}
