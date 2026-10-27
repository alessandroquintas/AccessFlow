import { Membership } from '../../domain/entities/membership.entity';
import { Organization } from '../../domain/entities/organization.entity';
import { Role } from '../../domain/entities/role.entity';

export interface OrganizationWithMembership {
  organization: Organization;
  membership: Membership;
  /** Papel do membership. */
  role: Role;
}
