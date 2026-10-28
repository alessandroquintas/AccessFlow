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
import { RequestContextModule } from '@/shared/infrastructure/request-context/request-context.module';
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
import { CustomPermissionRepository } from './domain/repositories/custom-permission.repository';
import { PrismaCustomPermissionRepository } from './infrastructure/persistence/prisma-custom-permission.repository';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { ListOrganizationRolesUseCase } from './application/use-cases/list-organization-roles.use-case';
import { GetMyPermissionsUseCase } from './application/use-cases/get-my-permissions.use-case';
import { CreateRoleUseCase } from './application/use-cases/create-role.use-case';
import { UpdateRoleUseCase } from './application/use-cases/update-role.use-case';
import { DeleteRoleUseCase } from './application/use-cases/delete-role.use-case';
import { AssignRoleUseCase } from './application/use-cases/assign-role.use-case';
import { CountMembersByRoleUseCase } from './application/use-cases/count-members-by-role.use-case';
import { RolesResolver } from './presentation/graphql/resolvers/roles.resolver';
import { PermissionsResolver } from './presentation/graphql/resolvers/permissions.resolver';
import { IntegrationAuthorizationController } from './presentation/http/controllers/integration-authorization.controller';
import { AuthorizeForIntegrationUseCase } from './application/use-cases/authorize-for-integration.use-case';
import { AuthorizationSnapshotPort } from './application/ports/authorization-snapshot.port';
import { PrismaAuthorizationSnapshotReader } from './infrastructure/persistence/prisma-authorization-snapshot.reader';
import { AuditLog } from './domain/repositories/audit-log.repository';
import { PrismaAuditLogRepository } from './infrastructure/persistence/prisma-audit-log.repository';
import { ListAuditEventsUseCase } from './application/use-cases/list-audit-events.use-case';
import { AuditResolver } from './presentation/graphql/resolvers/audit.resolver';
import { AuthorizationDecisionLog } from './domain/repositories/authorization-decision-log.repository';
import { PrismaAuthorizationDecisionLog } from './infrastructure/persistence/prisma-authorization-decision-log';
import { ListAuthorizationDecisionsUseCase } from './application/use-cases/list-authorization-decisions.use-case';
import { AuthorizationDecisionsResolver } from './presentation/graphql/resolvers/authorization-decisions.resolver';
import { GetPermissionCatalogUseCase } from './application/use-cases/get-permission-catalog.use-case';
import { ListOrganizationPermissionsUseCase } from './application/use-cases/list-organization-permissions.use-case';
import { CreatePermissionUseCase } from './application/use-cases/create-permission.use-case';
import { UpdatePermissionUseCase } from './application/use-cases/update-permission.use-case';
import { DeletePermissionUseCase } from './application/use-cases/delete-permission.use-case';
import { SecurityEventLog } from './domain/repositories/security-event-log.repository';
import { PrismaSecurityEventLog } from './infrastructure/persistence/prisma-security-event-log';
import { SecurityDenialRecorder } from '@/shared/application/ports/security-denial-recorder.port';
import { SecurityEventRecorder } from './application/services/security-event-recorder';
import { ListSecurityEventsUseCase } from './application/use-cases/list-security-events.use-case';
import { SecurityEventsResolver } from './presentation/graphql/resolvers/security-events.resolver';

@Module({
  imports: [PrismaModule, IdentityModule, ClockModule, RequestContextModule],
  controllers: [
    IntegrationMembersController,
    IntegrationAuthorizationController,
  ],
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
    {
      provide: CustomPermissionRepository,
      useClass: PrismaCustomPermissionRepository,
    },
    {
      provide: AuthorizationSnapshotPort,
      useClass: PrismaAuthorizationSnapshotReader,
    },
    { provide: AuditLog, useClass: PrismaAuditLogRepository },
    {
      provide: AuthorizationDecisionLog,
      useClass: PrismaAuthorizationDecisionLog,
    },
    { provide: SecurityEventLog, useClass: PrismaSecurityEventLog },

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
        AuditLog,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        roles: RoleRepository,
        memberships: MembershipRepository,
        users: UserDirectoryPort,
        audit: AuditLog,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new CreateOrganizationUseCase(
          organizations,
          roles,
          memberships,
          users,
          audit,
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
        AuditLog,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        audit: AuditLog,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new UpdateOrganizationUseCase(
          organizations,
          users,
          access,
          audit,
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
        AuditLog,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        memberships: MembershipRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        audit: AuditLog,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new RemoveMemberUseCase(
          organizations,
          memberships,
          users,
          access,
          audit,
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
        AuditLog,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        memberships: MembershipRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        audit: AuditLog,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new LeaveOrganizationUseCase(
          organizations,
          memberships,
          users,
          access,
          audit,
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
        AuditLog,
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
        audit: AuditLog,
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
          audit,
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
        AuditLog,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        invitations: InvitationRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        audit: AuditLog,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new RevokeInvitationUseCase(
          organizations,
          invitations,
          users,
          access,
          audit,
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
        MembershipRepository,
        UserDirectoryPort,
        AuditLog,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        invitations: InvitationRepository,
        organizations: OrganizationRepository,
        roles: RoleRepository,
        memberships: MembershipRepository,
        users: UserDirectoryPort,
        audit: AuditLog,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new AcceptInvitationUseCase(
          invitations,
          organizations,
          roles,
          memberships,
          users,
          audit,
          transactions,
          clock,
        ),
    },
    {
      provide: DeclineInvitationUseCase,
      inject: [
        InvitationRepository,
        OrganizationRepository,
        UserDirectoryPort,
        AuditLog,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        invitations: InvitationRepository,
        organizations: OrganizationRepository,
        users: UserDirectoryPort,
        audit: AuditLog,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new DeclineInvitationUseCase(
          invitations,
          organizations,
          users,
          audit,
          transactions,
          clock,
        ),
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
      inject: [
        CustomPermissionRepository,
        UserDirectoryPort,
        OrganizationAccessService,
      ],
      useFactory: (
        customPermissions: CustomPermissionRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
      ) => new GetMyPermissionsUseCase(customPermissions, users, access),
    },
    {
      provide: CreateRoleUseCase,
      inject: [
        OrganizationRepository,
        RoleRepository,
        CustomPermissionRepository,
        UserDirectoryPort,
        OrganizationAccessService,
        AuditLog,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        roles: RoleRepository,
        customPermissions: CustomPermissionRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        audit: AuditLog,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new CreateRoleUseCase(
          organizations,
          roles,
          customPermissions,
          users,
          access,
          audit,
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
        CustomPermissionRepository,
        UserDirectoryPort,
        OrganizationAccessService,
        AuditLog,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        roles: RoleRepository,
        memberships: MembershipRepository,
        customPermissions: CustomPermissionRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        audit: AuditLog,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new UpdateRoleUseCase(
          organizations,
          roles,
          memberships,
          customPermissions,
          users,
          access,
          audit,
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
        AuditLog,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        roles: RoleRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        audit: AuditLog,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new DeleteRoleUseCase(
          organizations,
          roles,
          users,
          access,
          audit,
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
        AuditLog,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        memberships: MembershipRepository,
        roles: RoleRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        audit: AuditLog,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new AssignRoleUseCase(
          organizations,
          memberships,
          roles,
          users,
          access,
          audit,
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
    {
      provide: GetPermissionCatalogUseCase,
      inject: [CustomPermissionRepository],
      useFactory: (customPermissions: CustomPermissionRepository) =>
        new GetPermissionCatalogUseCase(customPermissions),
    },
    {
      provide: ListOrganizationPermissionsUseCase,
      inject: [
        CustomPermissionRepository,
        UserDirectoryPort,
        OrganizationAccessService,
      ],
      useFactory: (
        customPermissions: CustomPermissionRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
      ) =>
        new ListOrganizationPermissionsUseCase(
          customPermissions,
          users,
          access,
        ),
    },
    {
      provide: CreatePermissionUseCase,
      inject: [
        OrganizationRepository,
        CustomPermissionRepository,
        UserDirectoryPort,
        OrganizationAccessService,
        AuditLog,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        customPermissions: CustomPermissionRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        audit: AuditLog,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new CreatePermissionUseCase(
          organizations,
          customPermissions,
          users,
          access,
          audit,
          transactions,
          clock,
        ),
    },
    {
      provide: UpdatePermissionUseCase,
      inject: [
        OrganizationRepository,
        CustomPermissionRepository,
        UserDirectoryPort,
        OrganizationAccessService,
        AuditLog,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        customPermissions: CustomPermissionRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        audit: AuditLog,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new UpdatePermissionUseCase(
          organizations,
          customPermissions,
          users,
          access,
          audit,
          transactions,
          clock,
        ),
    },
    {
      provide: DeletePermissionUseCase,
      inject: [
        OrganizationRepository,
        CustomPermissionRepository,
        UserDirectoryPort,
        OrganizationAccessService,
        AuditLog,
        TransactionManager,
        ClockPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        customPermissions: CustomPermissionRepository,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
        audit: AuditLog,
        transactions: TransactionManager,
        clock: ClockPort,
      ) =>
        new DeletePermissionUseCase(
          organizations,
          customPermissions,
          users,
          access,
          audit,
          transactions,
          clock,
        ),
    },
    {
      provide: AuthorizeForIntegrationUseCase,
      inject: [
        IntegrationClientRepository,
        OrganizationRepository,
        AuthorizationSnapshotPort,
        UserDirectoryPort,
        AuthorizationDecisionLog,
        ClockPort,
      ],
      useFactory: (
        integrationClients: IntegrationClientRepository,
        organizations: OrganizationRepository,
        snapshots: AuthorizationSnapshotPort,
        users: UserDirectoryPort,
        decisions: AuthorizationDecisionLog,
        clock: ClockPort,
      ) =>
        new AuthorizeForIntegrationUseCase(
          integrationClients,
          organizations,
          snapshots,
          users,
          decisions,
          clock,
        ),
    },
    {
      provide: ListAuditEventsUseCase,
      inject: [AuditLog, UserDirectoryPort, OrganizationAccessService],
      useFactory: (
        audit: AuditLog,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
      ) => new ListAuditEventsUseCase(audit, users, access),
    },
    {
      provide: ListAuthorizationDecisionsUseCase,
      inject: [
        AuthorizationDecisionLog,
        UserDirectoryPort,
        OrganizationAccessService,
      ],
      useFactory: (
        decisions: AuthorizationDecisionLog,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
      ) => new ListAuthorizationDecisionsUseCase(decisions, users, access),
    },
    {
      provide: ListSecurityEventsUseCase,
      inject: [SecurityEventLog, UserDirectoryPort, OrganizationAccessService],
      useFactory: (
        securityEvents: SecurityEventLog,
        users: UserDirectoryPort,
        access: OrganizationAccessService,
      ) => new ListSecurityEventsUseCase(securityEvents, users, access),
    },
    // Usado pelo filtro global, que grava as negações.
    {
      provide: SecurityDenialRecorder,
      inject: [
        SecurityEventLog,
        UserDirectoryPort,
        IntegrationClientRepository,
        ClockPort,
      ],
      useFactory: (
        securityEvents: SecurityEventLog,
        users: UserDirectoryPort,
        integrationClients: IntegrationClientRepository,
        clock: ClockPort,
      ) =>
        new SecurityEventRecorder(
          securityEvents,
          users,
          integrationClients,
          clock,
        ),
    },

    // Apresentação
    OrganizationsResolver,
    MembersResolver,
    InvitationsResolver,
    RolesResolver,
    PermissionsResolver,
    AuditResolver,
    AuthorizationDecisionsResolver,
    SecurityEventsResolver,
  ],
  exports: [SecurityDenialRecorder],
})
export class OrganizationsModule {}
