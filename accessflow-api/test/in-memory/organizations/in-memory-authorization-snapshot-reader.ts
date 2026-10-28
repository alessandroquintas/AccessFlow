import {
  AuthorizationSnapshot,
  AuthorizationSnapshotPort,
} from '@/modules/organizations/application/ports/authorization-snapshot.port';
import { InMemoryCustomPermissionRepository } from './in-memory-custom-permission-repository';
import { InMemoryMembershipRepository } from './in-memory-membership-repository';
import { InMemoryRoleRepository } from './in-memory-role-repository';

/** Mesma leitura do Prisma, sobre os repositórios em memória. */
export class InMemoryAuthorizationSnapshotReader extends AuthorizationSnapshotPort {
  constructor(
    private readonly memberships: InMemoryMembershipRepository,
    private readonly roles: InMemoryRoleRepository,
    private readonly customPermissions: InMemoryCustomPermissionRepository,
  ) {
    super();
  }

  async load(
    organizationId: string,
    userId: string,
    keys: readonly string[],
  ): Promise<AuthorizationSnapshot> {
    const membership = this.memberships.items.find(
      (m) =>
        m.organizationId === organizationId &&
        m.userId === userId &&
        m.isActive(),
    );
    // Apagado também: quem decide o que fazer com ele é o caso de uso.
    const role = membership
      ? (this.roles.items.find((r) => r.id === membership.roleId) ?? null)
      : null;
    const custom =
      await this.customPermissions.listByOrganization(organizationId);

    return {
      membership: membership ? { role } : null,
      customKeys: custom.map((p) => p.key).filter((key) => keys.includes(key)),
    };
  }
}
