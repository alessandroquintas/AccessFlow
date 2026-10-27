import {
  Invitation,
  InvitationStatus,
} from '@/modules/organizations/domain/entities/invitation.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { InvitationNotFoundError } from '@/modules/organizations/domain/errors/invitation-not-found.error';
import { InvitationLimitReachedError } from '@/modules/organizations/domain/errors/invitation-limit-reached.error';
import {
  InvitationCursor,
  InvitationPage,
  InvitationRepository,
} from '@/modules/organizations/domain/repositories/invitation.repository';
import { InMemoryMembershipRepository } from './in-memory-membership-repository';

function compareNewestFirst(a: Invitation, b: Invitation): number {
  const byDate = b.createdAt.getTime() - a.createdAt.getTime();
  if (byDate !== 0) return byDate;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

function isBefore(invitation: Invitation, cursor: InvitationCursor): boolean {
  const byDate = invitation.createdAt.getTime() - cursor.createdAt.getTime();
  return byDate < 0 || (byDate === 0 && invitation.id < cursor.id);
}

function isPending(invitation: Invitation): boolean {
  return invitation.status === InvitationStatus.PENDING;
}

function copy(invitation: Invitation): Invitation {
  return Invitation.restore({
    id: invitation.id,
    organizationId: invitation.organizationId,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    invitedByUserId: invitation.invitedByUserId,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  });
}

/**
 * Guarda e devolve cópias, como um banco: mudar a entidade recebida não
 * altera o que está gravado até ela voltar por um dos métodos de escrita.
 * Sem isso, o caso de uso mudaria a mesma instância guardada aqui (ex.:
 * `accept`) e a regra "só grava se ainda estiver PENDING" nunca falharia.
 */
export class InMemoryInvitationRepository extends InvitationRepository {
  private readonly rows = new Map<string, Invitation>();

  constructor(private readonly memberships: InMemoryMembershipRepository) {
    super();
  }

  /** Grava direto, sem regras: para montar o cenário dos testes. */
  seed(...invitations: Invitation[]): void {
    for (const invitation of invitations) {
      this.rows.set(invitation.id, copy(invitation));
    }
  }

  get items(): Invitation[] {
    return [...this.rows.values()].map(copy);
  }

  async findById(id: string): Promise<Invitation | null> {
    const row = this.rows.get(id);
    return row ? copy(row) : null;
  }

  async savePending(
    candidate: Invitation,
    {
      maxPendingPerOrganization,
      now,
    }: { maxPendingPerOrganization: number; now: Date },
  ): Promise<Invitation> {
    const existing = [...this.rows.values()].find(
      (i) =>
        i.organizationId === candidate.organizationId &&
        i.email === candidate.email &&
        isPending(i),
    );
    if (existing) {
      existing.renew(
        {
          role: candidate.role,
          invitedByUserId: candidate.invitedByUserId,
        },
        now,
      );
      return copy(existing);
    }

    const pending = [...this.rows.values()].filter(
      (i) =>
        i.organizationId === candidate.organizationId && i.isPendingAt(now),
    );
    if (pending.length >= maxPendingPerOrganization) {
      throw new InvitationLimitReachedError();
    }

    this.rows.set(candidate.id, copy(candidate));
    return copy(candidate);
  }

  async listPendingByOrganization(
    organizationId: string,
    { first, after }: { first: number; after?: InvitationCursor },
  ): Promise<InvitationPage> {
    const pending = [...this.rows.values()]
      .filter((i) => i.organizationId === organizationId && isPending(i))
      .filter((i) => !after || isBefore(i, after))
      .sort(compareNewestFirst);

    return {
      items: pending.slice(0, first).map(copy),
      hasNextPage: pending.length > first,
    };
  }

  async listPendingByEmail(email: string, now: Date): Promise<Invitation[]> {
    return [...this.rows.values()]
      .filter((i) => i.email === email && i.isPendingAt(now))
      .sort(compareNewestFirst)
      .map(copy);
  }

  async respond(invitation: Invitation): Promise<void> {
    this.writeIfPending(invitation);
  }

  async accept(
    invitation: Invitation,
    { userId, now }: { userId: string; now: Date },
  ): Promise<Membership> {
    this.writeIfPending(invitation);

    const existing = this.memberships.items.find(
      (m) =>
        m.organizationId === invitation.organizationId && m.userId === userId,
    );
    if (!existing) {
      const created = Membership.create(
        {
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role,
        },
        now,
      );
      this.memberships.items.push(created);
      return created;
    }

    // Mesma regra do Prisma: ativo fica como está, REMOVED é reativado.
    if (!existing.isActive()) existing.reactivate(invitation.role, now);
    return existing;
  }

  /** Mesma regra do UPDATE condicional do Prisma. */
  private writeIfPending(invitation: Invitation): void {
    const row = this.rows.get(invitation.id);
    if (!row || !isPending(row)) throw new InvitationNotFoundError();
    this.rows.set(invitation.id, copy(invitation));
  }
}
