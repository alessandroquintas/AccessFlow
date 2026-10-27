import type { Invitation } from '@/modules/organizations/domain/entities/invitation.entity';
import { InvitationStatus } from '@/modules/organizations/domain/entities/invitation.entity';
import type { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import {
  DefaultRoles,
  Role,
  RoleSystemKey,
} from '@/modules/organizations/domain/entities/role.entity';
import { RoleRepository } from '@/modules/organizations/domain/repositories/role.repository';

/** De onde `isInUse` lê. Lido na hora, então pode ligar repositórios criados depois. */
export type RoleUsageSource = () => {
  memberships: readonly Membership[];
  invitations: readonly Invitation[];
};

function copy(role: Role, changes: { permissions?: string[] } = {}): Role {
  return Role.restore({
    id: role.id,
    organizationId: role.organizationId,
    name: role.name,
    description: role.description,
    systemKey: role.systemKey,
    permissions: changes.permissions ?? role.permissions,
    deletedAt: role.deletedAt,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  });
}

/**
 * Guarda e devolve cópias, como um banco (igual ao de convites): o caso de
 * uso que altera o papel e depois falha não deixa a alteração gravada.
 */
export class InMemoryRoleRepository extends RoleRepository {
  private readonly rows = new Map<string, Role>();

  /** Sem `usage`, `isInUse` lança: o cenário precisa ligar as fontes. */
  constructor(private readonly usage?: RoleUsageSource) {
    super();
  }

  get items(): Role[] {
    return [...this.rows.values()].map((role) => copy(role));
  }

  /** Grava direto, sem regras: para montar o cenário dos testes. */
  seed(...roles: Role[]): void {
    for (const role of roles) this.rows.set(role.id, copy(role));
  }

  /** Grava os papéis padrão direto, sem regras: para montar o cenário. */
  seedDefaults(organizationId: string, now: Date = new Date()): DefaultRoles {
    const roles = Role.createDefaults(organizationId, now);
    this.seed(roles.owner, roles.member);
    return roles;
  }

  /** Papel de sistema da organização; falha se o cenário não o criou. */
  systemRole(organizationId: string, systemKey: RoleSystemKey): Role {
    const role = this.items.find(
      (r) => r.organizationId === organizationId && r.systemKey === systemKey,
    );
    if (!role) throw new Error(`Cenário sem o papel ${systemKey}.`);
    return role;
  }

  /** Acrescenta permissões a um papel gravado, sem as regras da edição. */
  grant(roleId: string, ...permissions: string[]): void {
    const role = this.rows.get(roleId)!;
    this.rows.set(
      roleId,
      copy(role, { permissions: [...role.permissions, ...permissions] }),
    );
  }

  async findById(organizationId: string, id: string): Promise<Role | null> {
    return (
      this.items.find(
        (r) =>
          r.id === id && r.organizationId === organizationId && !r.isDeleted(),
      ) ?? null
    );
  }

  async findSystemRole(
    organizationId: string,
    systemKey: RoleSystemKey,
  ): Promise<Role | null> {
    return (
      this.items.find(
        (r) =>
          r.organizationId === organizationId &&
          r.systemKey === systemKey &&
          !r.isDeleted(),
      ) ?? null
    );
  }

  async findByIds(ids: string[]): Promise<Role[]> {
    return this.items.filter((r) => ids.includes(r.id));
  }

  async listActiveByOrganization(organizationId: string): Promise<Role[]> {
    return this.items.filter(
      (r) => r.organizationId === organizationId && !r.isDeleted(),
    );
  }

  async createDefaults({ owner, member }: DefaultRoles): Promise<void> {
    this.seed(owner, member);
  }

  async create(role: Role): Promise<void> {
    this.seed(role);
  }

  async save(role: Role): Promise<void> {
    if (!this.rows.has(role.id)) throw new Error('Papel não gravado.');
    this.seed(role);
  }

  async isInUse(roleId: string): Promise<boolean> {
    if (!this.usage) throw new Error('Cenário sem fontes para isInUse.');
    const { memberships, invitations } = this.usage();
    return (
      memberships.some((m) => m.roleId === roleId && m.isActive()) ||
      invitations.some(
        (i) => i.roleId === roleId && i.status === InvitationStatus.PENDING,
      )
    );
  }
}
