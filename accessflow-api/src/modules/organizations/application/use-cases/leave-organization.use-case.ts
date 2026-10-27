import { ClockPort } from '@/shared/application/ports/clock.port';
import { MembershipRepository } from '../../domain/repositories/membership.repository';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';

export interface LeaveOrganizationInput {
  cognitoSub: string;
  organizationId: string;
}

export class LeaveOrganizationUseCase {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: LeaveOrganizationInput): Promise<void> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);

    const { membership } = await this.access.requireMember(
      input.organizationId,
      userId,
    );

    await this.memberships.remove(membership, this.clock.now());
  }
}
