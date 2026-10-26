import { Membership } from '../../domain/entities/membership.entity';
import { MemberProfile } from '../ports/user-directory.port';

export interface OrganizationMember {
  membership: Membership;
  profile: MemberProfile;
}

export interface OrganizationMembersPage {
  items: OrganizationMember[];
  hasNextPage: boolean;
}
