import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { Role } from '@/modules/organizations/domain/entities/role.entity';
import { LastOwnerError } from '@/modules/organizations/domain/errors/last-owner.error';
import {
  MembershipCursor,
  MembershipPage,
  MembershipRepository,
} from '@/modules/organizations/domain/repositories/membership.repository';
import { InMemoryRoleRepository } from './in-memory-role-repository';

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

  constructor(private readonly roles: InMemoryRoleRepository) {
    super();
  }

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

  async create(membership: Membership): Promise<void> {
    this.items.push(membership);
  }

  async countActiveByRole(
    organizationId: string,
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const m of this.items) {
      if (m.organizationId !== organizationId || !m.isActive()) continue;
      counts.set(m.roleId, (counts.get(m.roleId) ?? 0) + 1);
    }
    return counts;
  }

  async changeRole(
    membership: Membership,
    role: Role,
    now: Date,
  ): Promise<void> {
    if (!role.isOwner()) this.ensureNotLastOwner(membership);

    membership.changeRole(role.id, now);
    this.replace(membership);
  }

  async remove(membership: Membership, now: Date): Promise<void> {
    this.ensureNotLastOwner(membership);

    membership.remove(now);
    this.replace(membership);
  }

  /** Mesma regra do Prisma, com o papel gravado (e não o da entidade). */
  private ensureNotLastOwner(membership: Membership): void {
    const stored = this.items.find((m) => m.id === membership.id);
    if (!stored || !this.isActiveOwner(stored)) return;

    const otherOwners = this.items.filter(
      (m) =>
        m.organizationId === membership.organizationId &&
        m.id !== membership.id &&
        this.isActiveOwner(m),
    );
    if (otherOwners.length === 0) throw new LastOwnerError();
  }

  private replace(membership: Membership): void {
    const index = this.items.findIndex((m) => m.id === membership.id);
    if (index >= 0) {
      this.items[index] = membership;
    }
  }

  /** Mesma regra do Prisma: ativo e com o papel de sistema OWNER. */
  private isActiveOwner(membership: Membership): boolean {
    return (
      membership.isActive() &&
      this.roles.items.some(
        (role) => role.id === membership.roleId && role.isOwner(),
      )
    );
  }
}
