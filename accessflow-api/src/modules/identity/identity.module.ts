import { PrismaModule } from '@/shared/infrastructure/database/prisma.module';
import { Module } from '@nestjs/common';
import { UserRepository } from './domain/repositories/user.repository';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { TokenVerifierPort } from './application/ports/token-verifier.port';
import { EnvService } from '@/config/env.service';
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case';
import { JwtAuthGuard } from './presentation/graphql/guards/jwt-auth.guard';
import { IdentityResolver } from './presentation/graphql/resolvers/identity.resolver';
import { CognitoTokenVerifier } from './infrastructure/cognito/cognito-token.verifier';

@Module({
  imports: [PrismaModule],
  providers: [
    { provide: UserRepository, useClass: PrismaUserRepository },
    {
      provide: TokenVerifierPort,
      inject: [EnvService],
      useFactory: (env: EnvService) =>
        new CognitoTokenVerifier({
          userPoolId: env.get('COGNITO_USER_POOL_ID'),
          clientIds: env.get('COGNITO_CLIENT_IDS'),
        }),
    },
    {
      provide: GetCurrentUserUseCase,
      inject: [UserRepository],
      useFactory: (users: UserRepository) => new GetCurrentUserUseCase(users),
    },
    JwtAuthGuard,
    IdentityResolver,
  ],
})
export class IdentityModule {}
