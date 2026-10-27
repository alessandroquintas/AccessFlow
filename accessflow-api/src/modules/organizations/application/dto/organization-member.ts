import { Membership } from '../../domain/entities/membership.entity';
import { Role } from '../../domain/entities/role.entity';
import { MemberProfile } from '../ports/user-directory.port';

export interface OrganizationMember {
  membership: Membership;
  profile: MemberProfile;
  role: Role;
}

export interface OrganizationMembersPage {
  items: OrganizationMember[];
  hasNextPage: boolean;
}
