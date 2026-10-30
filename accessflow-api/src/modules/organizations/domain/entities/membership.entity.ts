import { restoreFromStorage } from '@/shared/domain/restore-from-storage';
import { randomUUID } from 'node:crypto';
import { InvalidMembershipError } from '../errors/invalid-membership.error';

export const MembershipStatus = {
  ACTIVE: 'ACTIVE',
  REMOVED: 'REMOVED',
} as const;

export type MembershipStatus =
  (typeof MembershipStatus)[keyof typeof MembershipStatus];

export interface MembershipProps {
  id: string;
  organizationId: string;
  userId: string;
  /** Papel da mesma organização (garantido pela FK composta). */
  roleId: string;
  status: MembershipStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Membership {
  private constructor(private props: MembershipProps) {}

  static create(
    input: { organizationId: string; userId: string; roleId: string },
    now: Date = new Date(),
  ): Membership {
    return Membership.build({
      id: randomUUID(),
      status: MembershipStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      ...input,
    });
  }

  /**
   * A partir do banco. Dado que não passa nas regras é corrupção: Error
   * comum (500), e não DomainError (400).
   */
  static restore(props: MembershipProps): Membership {
    return restoreFromStorage('Membership', () => Membership.build(props));
  }

  /** As regras da entidade; falha com DomainError. */
  private static build(props: MembershipProps): Membership {
    const { id, organizationId, userId, roleId } = props;

    if (!id?.trim()) {
      throw new InvalidMembershipError('id é obrigatório.');
    }

    if (!organizationId?.trim()) {
      throw new InvalidMembershipError('organizationId é obrigatório.');
    }

    if (!userId?.trim()) {
      throw new InvalidMembershipError('userId é obrigatório.');
    }

    if (!roleId?.trim()) {
      throw new InvalidMembershipError('roleId é obrigatório.');
    }

    return new Membership({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get userId(): string {
    return this.props.userId;
  }
  get roleId(): string {
    return this.props.roleId;
  }
  get status(): MembershipStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isActive(): boolean {
    return this.props.status === MembershipStatus.ACTIVE;
  }

  /** Idempotente: remover um membership já removido não muda nada. */
  remove(now: Date = new Date()): void {
    if (!this.isActive()) return;
    this.props = {
      ...this.props,
      status: MembershipStatus.REMOVED,
      updatedAt: now,
    };
  }

  /** Troca o papel de um membership ativo. O mesmo papel não muda nada. */
  changeRole(roleId: string, now: Date): void {
    if (!this.isActive()) {
      throw new InvalidMembershipError(
        'Só um membership ativo pode trocar de papel.',
      );
    }

    if (!roleId?.trim()) {
      throw new InvalidMembershipError('roleId é obrigatório.');
    }

    if (roleId === this.props.roleId) return;

    this.props = { ...this.props, roleId, updatedAt: now };
  }

  /** Volta um membership REMOVED para ACTIVE com o papel informado. */
  reactivate(roleId: string, now: Date): void {
    if (this.isActive()) {
      throw new InvalidMembershipError(
        'Só um membership removido pode ser reativado.',
      );
    }
    this.props = {
      ...this.props,
      roleId,
      status: MembershipStatus.ACTIVE,
      updatedAt: now,
    };
  }
}
