import { Role } from '../../domain/entities/role.entity';

export interface IntegrationMembership {
  organizationId: string;
  userId: string;
  role: Role;
  joinedAt: Date;
}
