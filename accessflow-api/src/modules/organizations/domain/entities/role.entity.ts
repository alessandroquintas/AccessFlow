import { randomUUID } from 'node:crypto';
import { InvalidRoleError } from '../errors/invalid-role.error';
import { DEFAULT_MEMBER_PERMISSIONS } from '../../policies/organization-permission';

/** Papéis com que toda organização nasce. Papéis customizados não têm. */
export const RoleSystemKey = {
  OWNER: 'OWNER',
  MEMBER: 'MEMBER',
} as const;

export type RoleSystemKey = (typeof RoleSystemKey)[keyof typeof RoleSystemKey];

export interface RoleProps {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  systemKey: RoleSystemKey | null;
  /** Permissões gravadas. O OWNER não tem nenhuma: as dele são calculadas. */
  permissions: readonly string[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DefaultRoles {
  owner: Role;
  member: Role;
}

/**
 * Papel de uma organização. O OWNER tem todas as permissões, inclusive as
 * que ainda não existem no catálogo; os demais, só as gravadas.
 */
export class Role {
  private readonly granted: ReadonlySet<string>;

  private constructor(private readonly props: RoleProps) {
    this.granted = new Set(props.permissions);
  }

  /** Os dois papéis de sistema de uma organização recém-criada. */
  static createDefaults(organizationId: string, now: Date): DefaultRoles {
    const system = (
      systemKey: RoleSystemKey,
      name: string,
      permissions: readonly string[],
    ) =>
      Role.restore({
        id: randomUUID(),
        organizationId,
        name,
        description: null,
        systemKey,
        permissions,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });

    return {
      owner: system(RoleSystemKey.OWNER, 'Owner', []),
      member: system(
        RoleSystemKey.MEMBER,
        'Member',
        DEFAULT_MEMBER_PERMISSIONS,
      ),
    };
  }

  static restore(props: RoleProps): Role {
    const { id, organizationId, name } = props;

    if (!id?.trim()) {
      throw new InvalidRoleError('id é obrigatório.');
    }

    if (!organizationId?.trim()) {
      throw new InvalidRoleError('organizationId é obrigatório.');
    }

    if (!name?.trim()) {
      throw new InvalidRoleError('name é obrigatório.');
    }

    return new Role({ ...props, permissions: [...props.permissions] });
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string | null {
    return this.props.description;
  }
  get systemKey(): RoleSystemKey | null {
    return this.props.systemKey;
  }
  get permissions(): readonly string[] {
    return this.props.permissions;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isOwner(): boolean {
    return this.props.systemKey === RoleSystemKey.OWNER;
  }

  isSystem(): boolean {
    return this.props.systemKey !== null;
  }

  isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  grants(permission: string): boolean {
    return this.isOwner() || this.granted.has(permission);
  }
}
