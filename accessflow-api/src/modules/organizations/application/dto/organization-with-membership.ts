import { Membership } from '../../domain/entities/membership.entity';
import { Organization } from '../../domain/entities/organization.entity';

export interface OrganizationWithMembership {
  organization: Organization;
  membership: Membership;
}
