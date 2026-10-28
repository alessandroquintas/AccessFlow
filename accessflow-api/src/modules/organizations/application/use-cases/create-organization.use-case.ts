import { ClockPort } from '@/shared/application/ports/clock.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { Membership } from '../../domain/entities/membership.entity';
import { Organization } from '../../domain/entities/organization.entity';
import { Role } from '../../domain/entities/role.entity';
import { MembershipRepository } from '../../domain/repositories/membership.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { OrganizationWithMembership } from '../dto/organization-with-membership';
import { UserDirectoryPort } from '../ports/user-directory.port';
import {
  AuditAction,
  AuditEvent,
  userActor,
} from '../../domain/entities/audit-event.entity';
import { AuditLog } from '../../domain/repositories/audit-log.repository';

export interface CreateOrganizationInput {
  cognitoSub: string;
  name: string;
  slug: string;
}

export class CreateOrganizationUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly roles: RoleRepository,
    private readonly memberships: MembershipRepository,
    private readonly users: UserDirectoryPort,
    private readonly audit: AuditLog,
    private readonly transactions: TransactionManager,
    private readonly clock: ClockPort,
  ) {}

  /** Organização, papéis padrão e o criador como OWNER: tudo ou nada. */
  async execute(
    input: CreateOrganizationInput,
  ): Promise<OrganizationWithMembership> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);
    const now = this.clock.now();

    const organization = Organization.create(
      { name: input.name, slug: input.slug },
      now,
    );
    const roles = Role.createDefaults(organization.id, now);
    const owner = Membership.create(
      { organizationId: organization.id, userId, roleId: roles.owner.id },
      now,
    );

    // A ordem segue as FKs: organização, papéis, o membership e o evento.
    await this.transactions.run(async () => {
      await this.organizations.create(organization);
      await this.roles.createDefaults(roles);
      await this.memberships.create(owner);
      await this.audit.record(
        AuditEvent.create(
          {
            organizationId: organization.id,
            actor: userActor(userId),
            action: AuditAction.ORGANIZATION_CREATED,
            targetId: organization.id,
            details: { name: organization.name, slug: organization.slug },
          },
          now,
        ),
      );
    });

    return { organization, membership: owner, role: roles.owner };
  }
}
