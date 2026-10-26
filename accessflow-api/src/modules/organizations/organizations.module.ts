import { Module } from '@nestjs/common';
import { PrismaModule } from '@/shared/infrastructure/database/prisma.module';
import { IdentityModule } from '@/modules/identity/identity.module';
import { GetCurrentUserUseCase } from '@/modules/identity/application/use-cases/get-current-user.use-case';
import { GetUsersByIdsUseCase } from '@/modules/identity/application/use-cases/get-users-by-ids.use-case';
import { OrganizationRepository } from './domain/repositories/organization.repository';
import { MembershipRepository } from './domain/repositories/membership.repository';
import { UserDirectoryPort } from './application/ports/user-directory.port';
import { OrganizationAccessService } from './application/services/organization-access.service';
import { ListMyOrganizationsUseCase } from './application/use-cases/list-my-organizations.use-case';
import { GetOrganizationUseCase } from './application/use-cases/get-organization.use-case';
import { UpdateOrganizationUseCase } from './application/use-cases/update-organization.use-case';
import { IdentityUserDirectory } from './infrastructure/identity/identity-user-directory';
import { OrganizationsResolver } from './presentation/graphql/resolvers/organizations.resolver';
import { PrismaOrganizationRepository } from './infrastructure/persistence/prisma-organization.repository';
import { PrismaMembershipRepository } from './infrastructure/persistence/prisma-membership.repository';
import { CreateOrganizationUseCase } from './application/use-cases/create-organization.use-case';

@Module({
  imports: [PrismaModule, IdentityModule],
  providers: [
    // Persistência
    { provide: OrganizationRepository, useClass: PrismaOrganizationRepository },
    { provide: MembershipRepository, useClass: PrismaMembershipRepository },

    // Adaptador para o módulo Identity
    {
      provide: UserDirectoryPort,
      inject: [GetCurrentUserUseCase, GetUsersByIdsUseCase],
      useFactory: (
        getCurrentUser: GetCurrentUserUseCase,
        getUsersByIds: GetUsersByIdsUseCase,
      ) => new IdentityUserDirectory(getCurrentUser, getUsersByIds),
    },

    // Serviços de aplicação
    {
      provide: OrganizationAccessService,
      inject: [OrganizationRepository, MembershipRepository],
      useFactory: (
        organizations: OrganizationRepository,
        memberships: MembershipRepository,
      ) => new OrganizationAccessService(organizations, memberships),
    },

    // Casos de uso
    {
      provide: CreateOrganizationUseCase,
      inject: [OrganizationRepository, UserDirectoryPort],
      useFactory: (
        organizations: OrganizationRepository,
        users: UserDirectoryPort,
      ) => new CreateOrganizationUseCase(organizations, users),
    },
    {
      provide: ListMyOrganizationsUseCase,
      inject: [OrganizationRepository, MembershipRepository, UserDirectoryPort],
      useFactory: (
        organizations: OrganizationRepository,
        memberships: MembershipRepository,
        users: UserDirectoryPort,
      ) => new ListMyOrganizationsUseCase(organizations, memberships, users),
    },
    {
      provide: GetOrganizationUseCase,
      inject: [UserDirectoryPort, OrganizationAccessService],
      useFactory: (
        users: UserDirectoryPort,
        access: OrganizationAccessService,
      ) => new GetOrganizationUseCase(users, access),
    },
    {
      provide: UpdateOrganizationUseCase,
      inject: [
        OrganizationRepository,
        UserDirectoryPort,
        OrganizationAccessService,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
      ) => new UpdateOrganizationUseCase(organizations, users, access),
    },

    // Apresentação
    OrganizationsResolver,
  ],
})
export class OrganizationsModule {}
