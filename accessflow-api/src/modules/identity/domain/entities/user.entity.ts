import { InvalidUserError } from '../errors/invalid-user.error';

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
};

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export interface UserProps {
  id: string;
  cognitoSub: string;
  name: string;
  email: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static restore(props: UserProps): User {
    if (!props.id.trim()) {
      throw new InvalidUserError('id é obrigatório');
    }
    if (!props.name.trim()) {
      throw new InvalidUserError('name é obrigatório');
    }
    if (!props.cognitoSub.trim()) {
      throw new InvalidUserError('cognitoSub é obrigatório');
    }
    if (!props.email.trim()) {
      throw new InvalidUserError('email é obrigatório');
    }

    return new User({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get cognitoSub(): string {
    return this.props.cognitoSub;
  }

  get name(): string {
    return this.props.name;
  }

  get email(): string {
    return this.props.email;
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
}
