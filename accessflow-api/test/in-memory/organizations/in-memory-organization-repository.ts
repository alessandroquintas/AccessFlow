import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { OrganizationRepository } from '@/modules/organizations/domain/repositories/organization.repository';
import { SlugAlreadyTakenError } from '@/modules/organizations/domain/errors/slug-already-taken.error';
import { InMemoryMembershipRepository } from './in-memory-membership-repository';

export class InMemoryOrganizationRepository extends OrganizationRepository {
  items: Organization[] = [];

  constructor(private readonly memberships: InMemoryMembershipRepository) {
    super();
  }

  async findById(id: string): Promise<Organization | null> {
    return this.items.find((o) => o.id === id) ?? null;
  }

  async findByIds(ids: string[]): Promise<Organization[]> {
    return this.items.filter((o) => ids.includes(o.id));
  }

  async createWithOwner(
    organization: Organization,
    owner: Membership,
  ): Promise<void> {
    if (this.items.some((o) => o.slug === organization.slug))
      throw new SlugAlreadyTakenError();
    this.items.push(organization);
    this.memberships.items.push(owner);
  }
}
