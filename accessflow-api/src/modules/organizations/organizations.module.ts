import { Module } from '@nestjs/common';
import { PrismaModule } from '@/shared/infrastructure/database/prisma.module';
import { IdentityModule } from '@/modules/identity/identity.module';
import { GetCurrentUserUseCase } from '@/modules/identity/application/use-cases/get-current-user.use-case';
import { GetUsersByIdsUseCase } from '@/modules/identity/application/use-cases/get-users-by-ids.use-case';
import { GetUserIdsByEmailUseCase } from '@/modules/identity/application/use-cases/get-user-ids-by-email.use-case';
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
import { ListOrganizationMembersUseCase } from './application/use-cases/list-organization-members.use-case';
import { RemoveMemberUseCase } from './application/use-cases/remove-member.use-case';
import { LeaveOrganizationUseCase } from './application/use-cases/leave-organization.use-case';
import { MembersResolver } from './presentation/graphql/resolvers/members.resolver';
import { IntegrationClientRepository } from './domain/repositories/integration-client.repository';
import { PrismaIntegrationClientRepository } from './infrastructure/persistence/prisma-integration-client.repository';
import { CheckMembershipForIntegrationUseCase } from './application/use-cases/check-membership-for-integration.use-case';
import { IntegrationMembersController } from './presentation/http/controllers/integration-members.controller';
import { ClockModule } from '@/shared/infrastructure/clock/clock.module';
import { ClockPort } from '@/shared/application/ports/clock.port';
import { InvitationRepository } from './domain/repositories/invitation.repository';
import { PrismaInvitationRepository } from './infrastructure/persistence/prisma-invitation.repository';
import { InviteMemberUseCase } from './application/use-cases/invite-member.use-case';
import { ListOrganizationInvitationsUseCase } from './application/use-cases/list-organization-invitations.use-case';
import { RevokeInvitationUseCase } from './application/use-cases/revoke-invitation.use-case';
import { ListMyInvitationsUseCase } from './application/use-cases/list-my-invitations.use-case';
import { AcceptInvitationUseCase } from './application/use-cases/accept-invitation.use-case';
import { DeclineInvitationUseCase } from './application/use-cases/decline-invitation.use-case';
import { InvitationsResolver } from './presentation/graphql/resolvers/invitations.resolver';

@Module({
  imports: [PrismaModule, IdentityModule, ClockModule],
  controllers: [IntegrationMembersController],
  providers: [
    // Persistência
    { provide: OrganizationRepository, useClass: PrismaOrganizationRepository },
    { provide: MembershipRepository, useClass: PrismaMembershipRepository },
    {
      provide: IntegrationClientRepository,
      useClass: PrismaIntegrationClientRepository,
    },
    { provide: InvitationRepository, useClass: PrismaInvitationRepository },

    // Adaptador para o módulo Identity
    {
      provide: UserDirectoryPort,
      inject: [
        GetCurrentUserUseCase,
        GetUsersByIdsUseCase,
        GetUserIdsByEmailUseCase,
      ],
      useFactory: (
        getCurrentUser: GetCurrentUserUseCase,
        getUsersByIds: GetUsersByIdsUseCase,
        getUserIdsByEmail: GetUserIdsByEmailUseCase,
      ) =>
        new IdentityUserDirectory(
          getCurrentUser,
          getUsersByIds,
          getUserIdsByEmail,
        ),
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
    {
      provide: ListOrganizationMembersUseCase,
      inject: [
        MembershipRepository,
        UserDirectoryPort,
        OrganizationAccessService,
      ],
      useFactory: (
        memberships: MembershipRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
      ) => new ListOrganizationMembersUseCase(memberships, users, access),
    },
    {
      provide: RemoveMemberUseCase,
      inject: [
        MembershipRepository,
        UserDirectoryPort,
        OrganizationAccessService,
      ],
      useFactory: (
        memberships: MembershipRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
      ) => new RemoveMemberUseCase(memberships, users, access),
    },
    {
      provide: LeaveOrganizationUseCase,
      inject: [
        MembershipRepository,
        UserDirectoryPort,
        OrganizationAccessService,
      ],
      useFactory: (
        memberships: MembershipRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
      ) => new LeaveOrganizationUseCase(memberships, users, access),
    },
    {
      provide: CheckMembershipForIntegrationUseCase,
      inject: [
        IntegrationClientRepository,
        OrganizationRepository,
        MembershipRepository,
        UserDirectoryPort,
      ],
      useFactory: (
        integrationClients: IntegrationClientRepository,
        organizations: OrganizationRepository,
        memberships: MembershipRepository,
        users: UserDirectoryPort,
      ) =>
        new CheckMembershipForIntegrationUseCase(
          integrationClients,
          organizations,
          memberships,
          users,
        ),
    },

    {
      provide: InviteMemberUseCase,
      inject: [
        InvitationRepository,
        MembershipRepository,
        UserDirectoryPort,
        OrganizationAccessService,
        ClockPort,
      ],
      useFactory: (
        invitations: InvitationRepository,
        memberships: MembershipRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        clock: ClockPort,
      ) =>
        new InviteMemberUseCase(invitations, memberships, users, access, clock),
    },
    {
      provide: ListOrganizationInvitationsUseCase,
      inject: [
        InvitationRepository,
        UserDirectoryPort,
        OrganizationAccessService,
      ],
      useFactory: (
        invitations: InvitationRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
      ) => new ListOrganizationInvitationsUseCase(invitations, users, access),
    },
    {
      provide: RevokeInvitationUseCase,
      inject: [
        InvitationRepository,
        UserDirectoryPort,
        OrganizationAccessService,
        ClockPort,
      ],
      useFactory: (
        invitations: InvitationRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        clock: ClockPort,
      ) => new RevokeInvitationUseCase(invitations, users, access, clock),
    },
    {
      provide: ListMyInvitationsUseCase,
      inject: [
        InvitationRepository,
        OrganizationRepository,
        UserDirectoryPort,
        ClockPort,
      ],
      useFactory: (
        invitations: InvitationRepository,
        organizations: OrganizationRepository,
        users: UserDirectoryPort,
        clock: ClockPort,
      ) =>
        new ListMyInvitationsUseCase(invitations, organizations, users, clock),
    },
    {
      provide: AcceptInvitationUseCase,
      inject: [
        InvitationRepository,
        OrganizationRepository,
        UserDirectoryPort,
        ClockPort,
      ],
      useFactory: (
        invitations: InvitationRepository,
        organizations: OrganizationRepository,
        users: UserDirectoryPort,
        clock: ClockPort,
      ) =>
        new AcceptInvitationUseCase(invitations, organizations, users, clock),
    },
    {
      provide: DeclineInvitationUseCase,
      inject: [InvitationRepository, UserDirectoryPort, ClockPort],
      useFactory: (
        invitations: InvitationRepository,
        users: UserDirectoryPort,
        clock: ClockPort,
      ) => new DeclineInvitationUseCase(invitations, users, clock),
    },

    // Apresentação
    OrganizationsResolver,
    MembersResolver,
    InvitationsResolver,
  ],
})
export class OrganizationsModule {}
