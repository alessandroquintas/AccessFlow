import {
  DefaultRoles,
  Role,
  RoleSystemKey,
} from '@/modules/organizations/domain/entities/role.entity';
import { RoleRepository } from '@/modules/organizations/domain/repositories/role.repository';

export class InMemoryRoleRepository extends RoleRepository {
  items: Role[] = [];

  /** Grava os papéis padrão direto, sem regras: para montar o cenário. */
  seedDefaults(organizationId: string, now: Date = new Date()): DefaultRoles {
    const roles = Role.createDefaults(organizationId, now);
    this.items.push(roles.owner, roles.member);
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

  /** Acrescenta permissões a um papel gravado, como a edição da Fase 8b. */
  grant(roleId: string, ...permissions: string[]): void {
    const index = this.items.findIndex((r) => r.id === roleId);
    const role = this.items[index];
    this.items[index] = Role.restore({
      id: role.id,
      organizationId: role.organizationId,
      name: role.name,
      description: role.description,
      systemKey: role.systemKey,
      permissions: [...role.permissions, ...permissions],
      deletedAt: role.deletedAt,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    });
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

  async createDefaults({ owner, member }: DefaultRoles): Promise<void> {
    this.items.push(owner, member);
  }
}
