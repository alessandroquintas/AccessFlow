import { randomUUID } from 'node:crypto';
import { InvalidMembershipError } from '../errors/invalid-membership.error';

export const MembershipRole = {
  OWNER: 'OWNER',
  MEMBER: 'MEMBER',
} as const;

export type MembershipRole =
  (typeof MembershipRole)[keyof typeof MembershipRole];

export const MembershipStatus = {
  ACTIVE: 'ACTIVE',
  REMOVED: 'REMOVED',
};

export type MembershipStatus =
  (typeof MembershipStatus)[keyof typeof MembershipStatus];

export interface MembershipProps {
  id: string;
  organizationId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Membership {
  private constructor(private props: MembershipProps) {}

  static create(
    input: { organizationId: string; userId: string; role: MembershipRole },
    now: Date = new Date(),
  ): Membership {
    return Membership.restore({
      id: randomUUID(),
      status: MembershipStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      ...input,
    });
  }

  static createOwner(
    organizationId: string,
    userId: string,
    now: Date = new Date(),
  ): Membership {
    return Membership.create(
      {
        organizationId,
        userId,
        role: MembershipRole.OWNER,
      },
      now,
    );
  }

  static restore(props: MembershipProps): Membership {
    const { id, organizationId, userId } = props;

    if (!id?.trim()) {
      throw new InvalidMembershipError('id é obrigatorio');
    }

    if (!organizationId?.trim()) {
      throw new InvalidMembershipError('oganizationId é obrigatorio.');
    }

    if (!userId?.trim()) {
      throw new InvalidMembershipError('userId é obrigatorio.');
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
  get role(): MembershipRole {
    return this.props.role;
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

  isOwner(): boolean {
    return this.isActive() && this.props.role === MembershipRole.OWNER;
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
}
