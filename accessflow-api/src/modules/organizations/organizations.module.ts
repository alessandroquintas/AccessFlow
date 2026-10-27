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
import { RoleRepository } from './domain/repositories/role.repository';
import { PrismaRoleRepository } from './infrastructure/persistence/prisma-role.repository';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { ListOrganizationRolesUseCase } from './application/use-cases/list-organization-roles.use-case';
import { GetMyPermissionsUseCase } from './application/use-cases/get-my-permissions.use-case';
import { CreateRoleUseCase } from './application/use-cases/create-role.use-case';
import { UpdateRoleUseCase } from './application/use-cases/update-role.use-case';
import { DeleteRoleUseCase } from './application/use-cases/delete-role.use-case';
import { AssignRoleUseCase } from './application/use-cases/assign-role.use-case';
import { CountMembersByRoleUseCase } from './application/use-cases/count-members-by-role.use-case';
import { RolesResolver } from './presentation/graphql/resolvers/roles.resolver';

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
    { provide: RoleRepository, useClass: PrismaRoleRepository },

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
      inject: [OrganizationRepository, MembershipRepository, RoleRepository],
      useFactory: (
        organizations: OrganizationRepository,
        memberships: MembershipRepository,
        roles: RoleRepository,
      ) => new OrganizationAccessService(organizations, memberships, roles),
    },

    // Casos de uso
    {
      provide: CreateOrganizationUseCase,
      inject: [
        OrganizationRepository,
        RoleRepository,
        MembershipRepository,
        UserDirectoryPort,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        roles: RoleRepository,
        memberships: MembershipRepository,
        users: UserDirectoryPort,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new CreateOrganizationUseCase(
          organizations,
          roles,
          memberships,
          users,
          transactions,
          clock,
        ),
    },
    {
      provide: ListMyOrganizationsUseCase,
      inject: [
        OrganizationRepository,
        MembershipRepository,
        RoleRepository,
        UserDirectoryPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        memberships: MembershipRepository,
        roles: RoleRepository,
        users: UserDirectoryPort,
      ) =>
        new ListMyOrganizationsUseCase(
          organizations,
          memberships,
          roles,
          users,
        ),
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
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new UpdateOrganizationUseCase(
          organizations,
          users,
          access,
          transactions,
          clock,
        ),
    },
    {
      provide: ListOrganizationMembersUseCase,
      inject: [
        MembershipRepository,
        RoleRepository,
        UserDirectoryPort,
        OrganizationAccessService,
      ],
      useFactory: (
        memberships: MembershipRepository,
        roles: RoleRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
      ) =>
        new ListOrganizationMembersUseCase(memberships, roles, users, access),
    },
    {
      provide: RemoveMemberUseCase,
      inject: [
        OrganizationRepository,
        MembershipRepository,
        UserDirectoryPort,
        OrganizationAccessService,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        memberships: MembershipRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new RemoveMemberUseCase(
          organizations,
          memberships,
          users,
          access,
          transactions,
          clock,
        ),
    },
    {
      provide: LeaveOrganizationUseCase,
      inject: [
        OrganizationRepository,
        MembershipRepository,
        UserDirectoryPort,
        OrganizationAccessService,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        memberships: MembershipRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new LeaveOrganizationUseCase(
          organizations,
          memberships,
          users,
          access,
          transactions,
          clock,
        ),
    },
    {
      provide: CheckMembershipForIntegrationUseCase,
      inject: [
        IntegrationClientRepository,
        OrganizationRepository,
        MembershipRepository,
        RoleRepository,
        UserDirectoryPort,
      ],
      useFactory: (
        integrationClients: IntegrationClientRepository,
        organizations: OrganizationRepository,
        memberships: MembershipRepository,
        roles: RoleRepository,
        users: UserDirectoryPort,
      ) =>
        new CheckMembershipForIntegrationUseCase(
          integrationClients,
          organizations,
          memberships,
          roles,
          users,
        ),
    },

    {
      provide: InviteMemberUseCase,
      inject: [
        OrganizationRepository,
        InvitationRepository,
        MembershipRepository,
        RoleRepository,
        UserDirectoryPort,
        OrganizationAccessService,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        invitations: InvitationRepository,
        memberships: MembershipRepository,
        roles: RoleRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new InviteMemberUseCase(
          organizations,
          invitations,
          memberships,
          roles,
          users,
          access,
          transactions,
          clock,
        ),
    },
    {
      provide: ListOrganizationInvitationsUseCase,
      inject: [
        InvitationRepository,
        RoleRepository,
        UserDirectoryPort,
        OrganizationAccessService,
      ],
      useFactory: (
        invitations: InvitationRepository,
        roles: RoleRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
      ) =>
        new ListOrganizationInvitationsUseCase(
          invitations,
          roles,
          users,
          access,
        ),
    },
    {
      provide: RevokeInvitationUseCase,
      inject: [
        OrganizationRepository,
        InvitationRepository,
        UserDirectoryPort,
        OrganizationAccessService,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        invitations: InvitationRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new RevokeInvitationUseCase(
          organizations,
          invitations,
          users,
          access,
          transactions,
          clock,
        ),
    },
    {
      provide: ListMyInvitationsUseCase,
      inject: [
        InvitationRepository,
        OrganizationRepository,
        RoleRepository,
        UserDirectoryPort,
        ClockPort,
      ],
      useFactory: (
        invitations: InvitationRepository,
        organizations: OrganizationRepository,
        roles: RoleRepository,
        users: UserDirectoryPort,
        clock: ClockPort,
      ) =>
        new ListMyInvitationsUseCase(
          invitations,
          organizations,
          roles,
          users,
          clock,
        ),
    },
    {
      provide: AcceptInvitationUseCase,
      inject: [
        InvitationRepository,
        OrganizationRepository,
        RoleRepository,
        UserDirectoryPort,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        invitations: InvitationRepository,
        organizations: OrganizationRepository,
        roles: RoleRepository,
        users: UserDirectoryPort,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new AcceptInvitationUseCase(
          invitations,
          organizations,
          roles,
          users,
          transactions,
          clock,
        ),
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
    {
      provide: ListOrganizationRolesUseCase,
      inject: [
        RoleRepository,
        MembershipRepository,
        UserDirectoryPort,
        OrganizationAccessService,
      ],
      useFactory: (
        roles: RoleRepository,
        memberships: MembershipRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
      ) => new ListOrganizationRolesUseCase(roles, memberships, users, access),
    },
    {
      provide: GetMyPermissionsUseCase,
      inject: [UserDirectoryPort, OrganizationAccessService],
      useFactory: (
        users: UserDirectoryPort,
        access: OrganizationAccessService,
      ) => new GetMyPermissionsUseCase(users, access),
    },
    {
      provide: CreateRoleUseCase,
      inject: [
        OrganizationRepository,
        RoleRepository,
        UserDirectoryPort,
        OrganizationAccessService,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        roles: RoleRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new CreateRoleUseCase(
          organizations,
          roles,
          users,
          access,
          transactions,
          clock,
        ),
    },
    {
      provide: UpdateRoleUseCase,
      inject: [
        OrganizationRepository,
        RoleRepository,
        MembershipRepository,
        UserDirectoryPort,
        OrganizationAccessService,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        roles: RoleRepository,
        memberships: MembershipRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new UpdateRoleUseCase(
          organizations,
          roles,
          memberships,
          users,
          access,
          transactions,
          clock,
        ),
    },
    {
      provide: DeleteRoleUseCase,
      inject: [
        OrganizationRepository,
        RoleRepository,
        UserDirectoryPort,
        OrganizationAccessService,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        roles: RoleRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new DeleteRoleUseCase(
          organizations,
          roles,
          users,
          access,
          transactions,
          clock,
        ),
    },
    {
      provide: AssignRoleUseCase,
      inject: [
        OrganizationRepository,
        MembershipRepository,
        RoleRepository,
        UserDirectoryPort,
        OrganizationAccessService,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        memberships: MembershipRepository,
        roles: RoleRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new AssignRoleUseCase(
          organizations,
          memberships,
          roles,
          users,
          access,
          transactions,
          clock,
        ),
    },
    {
      provide: CountMembersByRoleUseCase,
      inject: [MembershipRepository],
      useFactory: (memberships: MembershipRepository) =>
        new CountMembersByRoleUseCase(memberships),
    },

    // Apresentação
    OrganizationsResolver,
    MembersResolver,
    InvitationsResolver,
    RolesResolver,
  ],
})
export class OrganizationsModule {}
