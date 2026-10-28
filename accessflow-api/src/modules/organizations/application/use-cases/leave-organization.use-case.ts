import { ClockPort } from '@/shared/application/ports/clock.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { MembershipRepository } from '../../domain/repositories/membership.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';
import {
  AuditAction,
  AuditEvent,
  userActor,
} from '../../domain/entities/audit-event.entity';
import { AuditLog } from '../../domain/repositories/audit-log.repository';

export interface LeaveOrganizationInput {
  cognitoSub: string;
  organizationId: string;
}

export class LeaveOrganizationUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly memberships: MembershipRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
    private readonly audit: AuditLog,
    private readonly transactions: TransactionManager,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: LeaveOrganizationInput): Promise<void> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);

    await this.transactions.run(async () => {
      // Mesma ordem das demais escritas: organização → membership. O
      // membership é lido já com a organização travada.
      await this.organizations.lock(input.organizationId);
      const { organization, membership } = await this.access.requireMember(
        input.organizationId,
        userId,
      );

      const now = this.clock.now();
      await this.memberships.remove(membership, now);
      await this.audit.record(
        AuditEvent.create(
          {
            organizationId: organization.id,
            actor: userActor(userId),
            action: AuditAction.MEMBER_LEFT,
            targetId: userId,
            details: { roleId: membership.roleId },
          },
          now,
        ),
      );
    });
  }
}
