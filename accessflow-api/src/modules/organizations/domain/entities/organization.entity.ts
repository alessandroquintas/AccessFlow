import { randomUUID } from 'node:crypto';
import { OrganizationName } from '../value-objects/organization-name.vo';
import { Slug } from '../value-objects/slug.vo';
import { InvalidOrganizationError } from '../errors/invalid-organization.error';

export const OrganizationStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type OrganizationStatus =
  (typeof OrganizationStatus)[keyof typeof OrganizationStatus];

export interface OrganizationProps {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface OrganizationState extends Omit<OrganizationProps, 'name' | 'slug'> {
  name: OrganizationName;
  slug: Slug;
}

export class Organization {
  private constructor(private state: OrganizationState) {}

  static create(
    input: { name: string; slug: string },
    now: Date = new Date(),
  ): Organization {
    return new Organization({
      id: randomUUID(),
      name: OrganizationName.create(input.name),
      slug: Slug.create(input.slug),
      status: OrganizationStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: OrganizationProps): Organization {
    const { id, name, slug } = props;

    if (!id?.trim()) {
      throw new InvalidOrganizationError('id é obrigatório.');
    }

    return new Organization({
      ...props,
      name: OrganizationName.create(name),
      slug: Slug.restore(slug),
    });
  }

  get id(): string {
    return this.state.id;
  }

  get name(): string {
    return this.state.name.value;
  }

  get slug(): string {
    return this.state.slug.value;
  }

  get status(): OrganizationStatus {
    return this.state.status;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  get updatedAt(): Date {
    return this.state.updatedAt;
  }

  isActive(): boolean {
    return this.state.status === OrganizationStatus.ACTIVE;
  }

  /** O mesmo nome, depois de normalizado, não muda nada. */
  rename(name: string, now: Date = new Date()): void {
    const next = OrganizationName.create(name);
    if (next.value === this.state.name.value) return;

    this.state = { ...this.state, name: next, updatedAt: now };
  }
}
