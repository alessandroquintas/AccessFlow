import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { LastOwnerError } from '@/modules/organizations/domain/errors/last-owner.error';
import {
  MembershipCursor,
  MembershipPage,
  MembershipRepository,
} from '@/modules/organizations/domain/repositories/membership.repository';

function compareByCreatedAtAndId(a: Membership, b: Membership): number {
  const byDate = a.createdAt.getTime() - b.createdAt.getTime();
  if (byDate !== 0) return byDate;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function isAfter(membership: Membership, cursor: MembershipCursor): boolean {
  const byDate = membership.createdAt.getTime() - cursor.createdAt.getTime();
  return byDate > 0 || (byDate === 0 && membership.id > cursor.id);
}

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

  async listActiveByOrganization(
    organizationId: string,
    { first, after }: { first: number; after?: MembershipCursor },
  ): Promise<MembershipPage> {
    const active = this.items
      .filter((m) => m.organizationId === organizationId && m.isActive())
      .filter((m) => !after || isAfter(m, after))
      .sort(compareByCreatedAtAndId);

    return {
      items: active.slice(0, first),
      hasNextPage: active.length > first,
    };
  }

  async remove(membership: Membership): Promise<void> {
    if (membership.isOwner()) {
      const otherOwners = this.items.filter(
        (m) =>
          m.organizationId === membership.organizationId &&
          m.id !== membership.id &&
          m.isOwner(),
      );
      if (otherOwners.length === 0) throw new LastOwnerError();
    }

    membership.remove();
    const index = this.items.findIndex((m) => m.id === membership.id);
    if (index >= 0) {
      this.items[index] = membership;
    }
  }
}
