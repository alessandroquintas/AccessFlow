import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { MembershipRepository } from '@/modules/organizations/domain/repositories/membership.repository';

export class InMemoryMembershipRepository extends MembershipRepository {
  items: Membership[] = [];

  async findByOrganizationAndUser(
    organizationId: string,
    userId: string,
  ): Promise<Membership | null> {
    return (
      this.items.find(
        (m) => m.organizationId === organizationId && m.userId === userId,
      ) ?? null
    );
  }

  async listActiveByUser(userId: string): Promise<Membership[]> {
    return this.items.filter((m) => m.userId === userId && m.isActive());
  }
}
