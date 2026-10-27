import { ClockPort } from '@/shared/application/ports/clock.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { MembershipRepository } from '../../domain/repositories/membership.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';

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
    private readonly transactions: TransactionManager,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: LeaveOrganizationInput): Promise<void> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);

    await this.transactions.run(async () => {
      // Mesma ordem das demais escritas: organização → membership. O
      // membership é lido já com a organização travada.
      await this.organizations.lock(input.organizationId);
      const { membership } = await this.access.requireMember(
        input.organizationId,
        userId,
      );

      await this.memberships.remove(membership, this.clock.now());
    });
  }
}
