import { ClockPort } from '@/shared/application/ports/clock.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { OrganizationWithMembership } from '../dto/organization-with-membership';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';
import {
  AuditAction,
  AuditEvent,
  userActor,
} from '../../domain/entities/audit-event.entity';
import { AuditLog } from '../../domain/repositories/audit-log.repository';

export interface UpdateOrganizationInput {
  cognitoSub: string;
  organizationId: string;
  name: string;
}

export class UpdateOrganizationUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
    private readonly audit: AuditLog,
    private readonly transactions: TransactionManager,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    input: UpdateOrganizationInput,
  ): Promise<OrganizationWithMembership> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);

    return this.transactions.run(async () => {
      // Trava antes de checar: uma mudança de papel concorrente, que também
      // trava a organização, não passa entre a checagem e a escrita.
      await this.organizations.lock(input.organizationId);
      const context = await this.access.requirePermission(
        input.organizationId,
        userId,
        OrganizationPermission.ORGANIZATIONS_UPDATE,
      );

      const { organization } = context;
      const previous = organization.name;
      const now = this.clock.now();
      organization.rename(input.name, now);

      // O mesmo nome não é mudança: nada é gravado.
      if (organization.name !== previous) {
        await this.organizations.save(organization);
        await this.audit.record(
          AuditEvent.create(
            {
              organizationId: organization.id,
              actor: userActor(userId),
              action: AuditAction.ORGANIZATION_UPDATED,
              targetId: organization.id,
              details: {
                changes: { name: { from: previous, to: organization.name } },
              },
            },
            now,
          ),
        );
      }

      return context;
    });
  }
}
