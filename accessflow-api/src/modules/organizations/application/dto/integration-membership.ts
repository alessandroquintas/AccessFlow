import { MembershipRole } from '../../domain/entities/membership.entity';

export interface IntegrationMembership {
  organizationId: string;
  userId: string;
  role: MembershipRole;
  joinedAt: Date;
}
