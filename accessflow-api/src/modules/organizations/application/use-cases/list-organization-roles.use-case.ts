import { Role, RoleSystemKey } from '../../domain/entities/role.entity';
import { MembershipRepository } from '../../domain/repositories/membership.repository';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { OrganizationRole } from '../dto/organization-role';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';

export interface ListOrganizationRolesInput {
  cognitoSub: string;
  organizationId: string;
}

const SYSTEM_ORDER: Record<RoleSystemKey, number> = { OWNER: 0, MEMBER: 1 };

/** Sistema primeiro (OWNER, MEMBER), depois por nome; o id desempata. */
function compareRoles(a: Role, b: Role): number {
  const rank = (role: Role) =>
    role.systemKey === null ? 2 : SYSTEM_ORDER[role.systemKey];
  return (
    rank(a) - rank(b) ||
    a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }) ||
    (a.id < b.id ? -1 : 1)
  );
}

export class ListOrganizationRolesUseCase {
  constructor(
    private readonly roles: RoleRepository,
    private readonly memberships: MembershipRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
  ) {}

  /** Papéis não apagados, com a contagem de membros ativos de cada um. */
  async execute(
    input: ListOrganizationRolesInput,
  ): Promise<OrganizationRole[]> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);
    const organizationId = input.organizationId.toLowerCase();

    await this.access.requirePermission(
      organizationId,
      userId,
      OrganizationPermission.ROLES_READ,
    );

    const [roles, counts] = await Promise.all([
      this.roles.listActiveByOrganization(organizationId),
      this.memberships.countActiveByRole(organizationId),
    ]);

    return [...roles].sort(compareRoles).map((role) => ({
      role,
      memberCount: counts.get(role.id) ?? 0,
    }));
  }
}
