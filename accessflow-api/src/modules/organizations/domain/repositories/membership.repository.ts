import { Membership } from '../entities/membership.entity';

export abstract class MembershipRepository {
  abstract findByOrganizationAndUser(
    organizationId: string,
    userId: string,
  ): Promise<Membership | null>;

  abstract listActiveByUser(userId: string): Promise<Membership[]>;
}
