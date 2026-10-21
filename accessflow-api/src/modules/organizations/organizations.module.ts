import { PrismaModule } from '@/shared/infrastructure/database/prisma.module';
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationRepository } from './domain/repositories/organization.repository';
import { PrismaOrganizationRepository } from './infrastructure/persistenece/prisma-organization.repository';
import { MembershipRepository } from './domain/repositories/membership.repository';
import { PrismaMembershipRepository } from './infrastructure/persistenece/prisma-membership.repository';
import { UserDirectoryPort } from './application/ports/user-directory.port';
import { IdentityUserDirectory } from './infrastructure/identity/identity-user-directory';
import { OrganizationAccessService } from './application/services/organization-access.service';
import { OrganizationsResolver } from './presentation/graphql/resolvers/organizations.resolver';
import { CreateOrganizationUseCase } from './application/use-cases/create-organization.use.case';
import { ListMyOrganizationsUseCase } from './application/use-cases/list-my-organizations.use-case';
import { GetOrganizationUseCase } from './application/use-cases/get-organization.use-case';

@Module({
  imports: [PrismaModule, IdentityModule],
  providers: [
    { provide: OrganizationRepository, useClass: PrismaOrganizationRepository },
    { provide: MembershipRepository, useClass: PrismaMembershipRepository },
    { provide: UserDirectoryPort, useClass: IdentityUserDirectory },
    {
      provide: OrganizationAccessService,
      inject: [OrganizationRepository, MembershipRepository],
      useFactory: (
        organizations: OrganizationRepository,
        memberships: MembershipRepository,
      ) => new OrganizationAccessService(organizations, memberships),
    },
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
    OrganizationsResolver,
  ],
})
export class OrganizationsModule {}
