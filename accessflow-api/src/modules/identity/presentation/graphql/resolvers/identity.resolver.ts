import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthenticatedIdentity } from '@/modules/identity/application/ports/token-verifier.port';
import { GetCurrentUserUseCase } from '@/modules/identity/application/use-cases/get-current-user.use-case';
import { UserType } from '../types/user.type';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentIdentity } from '../decorators/current-identity.decorator';
import { ProvisionUserUseCase } from '@/modules/identity/application/use-cases/provision-user.use.case';
import { CurrentAccessToken } from '../decorators/current-access-token.decorator';
import { ProvisionMeInput } from '../inputs/provision-me.input';

@Resolver(() => UserType)
export class IdentityResolver {
  constructor(
    private readonly getCurrentUser: GetCurrentUserUseCase,
    private readonly provisionUser: ProvisionUserUseCase,
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
}
