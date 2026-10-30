import { restoreFromStorage } from '@/shared/domain/restore-from-storage';
import { randomUUID } from 'node:crypto';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { InvalidInvitationError } from '../errors/invalid-invitation.error';
import { InvitationNotFoundError } from '../errors/invitation-not-found.error';

export const InvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  REVOKED: 'REVOKED',
} as const;

export type InvitationStatus =
  (typeof InvitationStatus)[keyof typeof InvitationStatus];

export interface InvitationProps {
  id: string;
  organizationId: string;
  email: string;
  /** Papel ao aceitar, da mesma organização (garantido pela FK composta). */
  roleId: string;
  status: InvitationStatus;
  invitedByUserId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface InvitationState extends Omit<InvitationProps, 'email'> {
  email: Email;
}

/**
 * Convite para entrar numa organização, endereçado a um e-mail.
 * "Expirado" não é um status gravado: é um PENDING com `expiresAt` vencido.
 * Os métodos exigem `now` para que a expiração siga o relógio injetado.
 */
export class Invitation {
  static readonly VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;

  private constructor(private state: InvitationState) {}

  static create(
    input: {
      organizationId: string;
      email: string;
      roleId: string;
      invitedByUserId: string;
    },
    now: Date,
  ): Invitation {
    return Invitation.build({
      id: randomUUID(),
      ...input,
      status: InvitationStatus.PENDING,
      expiresAt: Invitation.expirationFrom(now),
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * A partir do banco. Dado que não passa nas regras é corrupção: Error
   * comum (500), e não DomainError (400).
   */
  static restore(props: InvitationProps): Invitation {
    return restoreFromStorage('Invitation', () => Invitation.build(props));
  }

  /** As regras da entidade; falha com DomainError. */
  private static build(props: InvitationProps): Invitation {
    const { id, organizationId, roleId, invitedByUserId } = props;

    if (!id?.trim()) {
      throw new InvalidInvitationError('id é obrigatório.');
    }

    if (!organizationId?.trim()) {
      throw new InvalidInvitationError('organizationId é obrigatório.');
    }

    if (!roleId?.trim()) {
      throw new InvalidInvitationError('roleId é obrigatório.');
    }

    if (!invitedByUserId?.trim()) {
      throw new InvalidInvitationError('invitedByUserId é obrigatório.');
    }

    return new Invitation({ ...props, email: Email.create(props.email) });
  }

  get id(): string {
    return this.state.id;
  }
  get organizationId(): string {
    return this.state.organizationId;
  }
  get email(): string {
    return this.state.email.value;
  }
  get roleId(): string {
    return this.state.roleId;
  }
  get status(): InvitationStatus {
    return this.state.status;
  }
  get invitedByUserId(): string {
    return this.state.invitedByUserId;
  }
  get expiresAt(): Date {
    return this.state.expiresAt;
  }
  get createdAt(): Date {
    return this.state.createdAt;
  }
  get updatedAt(): Date {
    return this.state.updatedAt;
  }

  /** PENDING e ainda dentro do prazo: pode ser aceito ou recusado. */
  isPendingAt(now: Date): boolean {
    return (
      this.state.status === InvitationStatus.PENDING &&
      this.state.expiresAt.getTime() > now.getTime()
    );
  }

  isExpiredAt(now: Date): boolean {
    return (
      this.state.status === InvitationStatus.PENDING &&
      this.state.expiresAt.getTime() <= now.getTime()
    );
  }

  /** Reaproveita o convite PENDING, mesmo expirado, com novo prazo. */
  renew(input: { roleId: string; invitedByUserId: string }, now: Date): void {
    this.requireStatusPending();
    this.state = {
      ...this.state,
      roleId: input.roleId,
      invitedByUserId: input.invitedByUserId,
      expiresAt: Invitation.expirationFrom(now),
      updatedAt: now,
    };
  }

  accept(now: Date): void {
    this.requirePendingAt(now);
    this.transitionTo(InvitationStatus.ACCEPTED, now);
  }

  decline(now: Date): void {
    this.requirePendingAt(now);
    this.transitionTo(InvitationStatus.DECLINED, now);
  }

  /** Também vale para convites expirados, que continuam PENDING. */
  revoke(now: Date): void {
    this.requireStatusPending();
    this.transitionTo(InvitationStatus.REVOKED, now);
  }

  private requireStatusPending(): void {
    if (this.state.status !== InvitationStatus.PENDING) {
      throw new InvitationNotFoundError();
    }
  }

  private requirePendingAt(now: Date): void {
    if (!this.isPendingAt(now)) throw new InvitationNotFoundError();
  }

  private transitionTo(status: InvitationStatus, now: Date): void {
    this.state = { ...this.state, status, updatedAt: now };
  }

  private static expirationFrom(now: Date): Date {
    return new Date(now.getTime() + Invitation.VALIDITY_MS);
  }
}
