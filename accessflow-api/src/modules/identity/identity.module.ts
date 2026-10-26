import { PrismaModule } from '@/shared/infrastructure/database/prisma.module';
import { Module } from '@nestjs/common';
import { UserRepository } from './domain/repositories/user.repository';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { TokenVerifierPort } from './application/ports/token-verifier.port';
import { EnvService } from '@/config/env.service';
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case';
import { JwtAuthGuard } from './presentation/auth/guards/jwt-auth.guard';
import { IdentityResolver } from './presentation/graphql/resolvers/identity.resolver';
import { CognitoTokenVerifier } from './infrastructure/cognito/cognito-token.verifier';
import { IdentityProfilePort } from './application/ports/identity-profile.port';
import { ConfigService } from '@nestjs/config';
import { Env } from '@/config/env.schema';
import { CognitoIdentityProfileProvider } from './infrastructure/cognito/cognito-identity-profile.provider';
import { ProvisionUserUseCase } from './application/use-cases/provision-user.use-case';
import { GetUsersByIdsUseCase } from './application/use-cases/get-users-by-ids.use-case';
import { UpdateMyProfileUseCase } from './application/use-cases/update-my-profile.use-case';
import { MachineTokenVerifierPort } from './application/ports/machine-token-verifier.port';
import { CognitoMachineTokenVerifier } from './infrastructure/cognito/cognito-machine-token.verifier';
import { MachineAuthGuard } from './presentation/auth/guards/machine-auth.guard';

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
      provide: MachineTokenVerifierPort,
      inject: [EnvService],
      useFactory: (env: EnvService) =>
        new CognitoMachineTokenVerifier({
          userPoolId: env.get('COGNITO_USER_POOL_ID'),
          clientIds: env.get('COGNITO_MACHINE_CLIENT_IDS'),
        }),
    },
    {
      provide: GetCurrentUserUseCase,
      inject: [UserRepository],
      useFactory: (users: UserRepository) => new GetCurrentUserUseCase(users),
    },
    {
      provide: IdentityProfilePort,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        CognitoIdentityProfileProvider.fromUserPoolId(
          config.get('COGNITO_USER_POOL_ID', { infer: true }),
        ),
    },
    {
      provide: ProvisionUserUseCase,
      inject: [UserRepository, IdentityProfilePort],
      useFactory: (users: UserRepository, profile: IdentityProfilePort) =>
        new ProvisionUserUseCase(users, profile),
    },
    {
      provide: GetUsersByIdsUseCase,
      inject: [UserRepository],
      useFactory: (users: UserRepository) => new GetUsersByIdsUseCase(users),
    },
    {
      provide: UpdateMyProfileUseCase,
      inject: [UserRepository, GetCurrentUserUseCase],
      useFactory: (
        users: UserRepository,
        getCurrentUser: GetCurrentUserUseCase,
      ) => new UpdateMyProfileUseCase(users, getCurrentUser),
    },
    JwtAuthGuard,
    MachineAuthGuard,
    IdentityResolver,
  ],
  exports: [
    GetCurrentUserUseCase,
    GetUsersByIdsUseCase,
    TokenVerifierPort,
    MachineTokenVerifierPort,
    JwtAuthGuard,
    MachineAuthGuard,
  ],
})
export class IdentityModule {}
