import { CustomPermission } from '@/modules/organizations/domain/entities/custom-permission.entity';
import { PermissionKeyTakenError } from '@/modules/organizations/domain/errors/permission-key-taken.error';
import { CustomPermissionRepository } from '@/modules/organizations/domain/repositories/custom-permission.repository';
import { InMemoryRoleRepository } from './in-memory-role-repository';

function copy(permission: CustomPermission): CustomPermission {
  return CustomPermission.restore({
    id: permission.id,
    organizationId: permission.organizationId,
    key: permission.key,
    description: permission.description,
    createdAt: permission.createdAt,
    updatedAt: permission.updatedAt,
  });
}

/** Guarda e devolve cópias, como um banco (igual aos de papel e convite). */
export class InMemoryCustomPermissionRepository extends CustomPermissionRepository {
  private readonly rows = new Map<string, CustomPermission>();

  constructor(private readonly roles: InMemoryRoleRepository) {
    super();
  }

  get items(): CustomPermission[] {
    return [...this.rows.values()].map(copy);
  }

  /** Grava direto, sem regras: para montar o cenário dos testes. */
  seed(...permissions: CustomPermission[]): void {
    for (const permission of permissions) {
      this.rows.set(permission.id, copy(permission));
    }
  }

  async listByOrganization(
    organizationId: string,
  ): Promise<CustomPermission[]> {
    return this.items
      .filter((p) => p.organizationId === organizationId)
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }

  async findByKey(
    organizationId: string,
    key: string,
  ): Promise<CustomPermission | null> {
    return (
      this.items.find(
        (p) => p.organizationId === organizationId && p.key === key,
      ) ?? null
    );
  }

  async create(permission: CustomPermission): Promise<void> {
    // Mesma regra da unique (organization_id, key).
    if (await this.findByKey(permission.organizationId, permission.key)) {
      throw new PermissionKeyTakenError();
    }
    this.seed(permission);
  }

  async save(permission: CustomPermission): Promise<void> {
    if (!this.rows.has(permission.id))
      throw new Error('Permissão não gravada.');
    this.seed(permission);
  }

  async delete(permission: CustomPermission): Promise<void> {
    for (const role of this.roles.items) {
      if (
        role.organizationId === permission.organizationId &&
        role.isDeleted() &&
        role.permissions.includes(permission.key)
      ) {
        this.roles.revoke(role.id, permission.key);
      }
    }
    this.rows.delete(permission.id);
  }

  async isInUse(organizationId: string, key: string): Promise<boolean> {
    return this.roles.items.some(
      (role) =>
        role.organizationId === organizationId &&
        !role.isDeleted() &&
        role.permissions.includes(key),
    );
  }
}
