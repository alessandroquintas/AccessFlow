import { restoreFromStorage } from '@/shared/domain/restore-from-storage';
import { randomUUID } from 'node:crypto';
import { InvalidUserError } from '../errors/invalid-user.error';
import { Email } from '@/shared/domain/value-objects/email.vo';
import { UserName } from '../value-objects/user-name.vo';

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export interface UserProps {
  id: string;
  cognitoSub: string;
  name: string;
  email: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface UserState extends Omit<UserProps, 'name' | 'email'> {
  name: UserName;
  email: Email;
}
export class User {
  private constructor(private props: UserState) {}

  static create(
    input: { cognitoSub: string; name: string; email: string },
    now: Date = new Date(),
  ): User {
    return User.build({
      id: randomUUID(),
      cognitoSub: input.cognitoSub,
      name: input.name,
      email: input.email,
      status: UserStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * A partir do banco. Dado que não passa nas regras é corrupção: Error
   * comum (500), e não DomainError (400).
   */
  static restore(props: UserProps): User {
    return restoreFromStorage('User', () => User.build(props));
  }

  /** As regras da entidade; falha com DomainError. */
  private static build(props: UserProps): User {
    if (!props.id?.trim()) throw new InvalidUserError('id é obrigatório.');
    if (!props.cognitoSub?.trim())
      throw new InvalidUserError('cognitoSub é obrigatório.');

    return new User({
      ...props,
      name: UserName.create(props.name),
      email: Email.create(props.email),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get cognitoSub(): string {
    return this.props.cognitoSub;
  }

  get name(): string {
    return this.props.name.value;
  }

  get email(): string {
    return this.props.email.value;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isActive(): boolean {
    return this.props.status === UserStatus.ACTIVE;
  }

  rename(name: string, now: Date = new Date()): void {
    this.props = {
      ...this.props,
      name: UserName.create(name),
      updatedAt: now,
    };
  }
}
