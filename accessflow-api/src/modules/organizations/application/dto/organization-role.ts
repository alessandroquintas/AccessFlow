import { Role } from '../../domain/entities/role.entity';

export interface OrganizationRole {
  role: Role;
  /** Memberships ativos com o papel. */
  memberCount: number;
}
