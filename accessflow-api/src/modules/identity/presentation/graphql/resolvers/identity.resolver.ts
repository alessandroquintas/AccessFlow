import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import type { AuthenticatedIdentity } from '@/modules/identity/application/ports/token-verifier.port';
import { GetCurrentUserUseCase } from '@/modules/identity/application/use-cases/get-current-user.use-case';
import { UserType } from '../types/user.type';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentIdentity } from '../decorators/current-identity.decorator';

@Resolver(() => UserType)
export class IdentityResolver {
  constructor(private readonly getCurrentUser: GetCurrentUserUseCase) {}

  @Query(() => UserType, { description: 'Perfil do usuário autenticado.' })
  @UseGuards(JwtAuthGuard)
  async me(
    @CurrentIdentity() identity: AuthenticatedIdentity,
  ): Promise<UserType> {
    const user = await this.getCurrentUser.execute(identity.sub);
    return UserType.fromDomain(user);
  }
}
