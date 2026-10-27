import { randomUUID } from 'node:crypto';
import { InvalidRoleError } from '../errors/invalid-role.error';
import { SystemRoleImmutableError } from '../errors/system-role-immutable.error';
import { RoleName } from '../value-objects/role-name.vo';
import {
  DEFAULT_MEMBER_PERMISSIONS,
  OrganizationPermission,
  parsePermissions,
  sortPermissions,
} from '../../policies/organization-permission';

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
  /**
   * Permissões gravadas, na ordem do catálogo. O OWNER não tem nenhuma: as
   * dele são calculadas.
   */
  permissions: readonly string[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RoleState extends Omit<RoleProps, 'name'> {
  name: RoleName;
}

export interface DefaultRoles {
  owner: Role;
  member: Role;
}

/**
 * Papel de uma organização. O OWNER tem todas as permissões, inclusive as
 * que ainda não existem no catálogo; os demais, só as gravadas.
 *
 * Papéis de sistema: o OWNER não muda (nome, permissões, exclusão); o
 * MEMBER só pode ter as permissões trocadas. Violações lançam
 * SystemRoleImmutableError.
 */
export class Role {
  /** Papéis customizados não apagados; os de sistema não contam. */
  static readonly MAX_CUSTOM_PER_ORGANIZATION = 50;

  private granted: ReadonlySet<string>;

  private constructor(private state: RoleState) {
    this.granted = new Set(state.permissions);
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

  /**
   * Papel customizado. As permissões precisam estar no catálogo
   * (InvalidPermissionError); repetidas são descartadas.
   */
  static create(
    input: {
      organizationId: string;
      name: string;
      permissions: readonly string[];
    },
    now: Date,
  ): Role {
    return Role.restore({
      id: randomUUID(),
      organizationId: input.organizationId,
      name: RoleName.create(input.name).value,
      description: null,
      systemKey: null,
      permissions: parsePermissions(input.permissions),
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: RoleProps): Role {
    const { id, organizationId } = props;

    if (!id?.trim()) {
      throw new InvalidRoleError('id é obrigatório.');
    }

    if (!organizationId?.trim()) {
      throw new InvalidRoleError('organizationId é obrigatório.');
    }

    return new Role({
      ...props,
      name: RoleName.create(props.name),
      permissions: sortPermissions(props.permissions),
    });
  }

  get id(): string {
    return this.state.id;
  }
  get organizationId(): string {
    return this.state.organizationId;
  }
  get name(): string {
    return this.state.name.value;
  }
  get description(): string | null {
    return this.state.description;
  }
  get systemKey(): RoleSystemKey | null {
    return this.state.systemKey;
  }
  get permissions(): readonly string[] {
    return this.state.permissions;
  }
  get deletedAt(): Date | null {
    return this.state.deletedAt;
  }
  get createdAt(): Date {
    return this.state.createdAt;
  }
  get updatedAt(): Date {
    return this.state.updatedAt;
  }

  isOwner(): boolean {
    return this.state.systemKey === RoleSystemKey.OWNER;
  }

  isSystem(): boolean {
    return this.state.systemKey !== null;
  }

  isDeleted(): boolean {
    return this.state.deletedAt !== null;
  }

  /** Mesmo nome pela regra de unicidade: sem diferenciar a caixa. */
  hasSameNameAs(other: Role): boolean {
    return this.state.name.sameAs(other.state.name);
  }

  grants(permission: string): boolean {
    return this.isOwner() || this.granted.has(permission);
  }

  /** As que o papel concede de fato: para o OWNER, o catálogo inteiro. */
  effectivePermissions(): readonly string[] {
    return this.isOwner()
      ? Object.values(OrganizationPermission)
      : this.state.permissions;
  }

  /** Mesmo nome, com a mesma grafia, não é alteração: não muda nada. */
  rename(name: string, now: Date): void {
    const next = RoleName.create(name);
    if (next.value === this.name) return;

    if (this.isSystem()) {
      throw new SystemRoleImmutableError(
        'O nome de um papel de sistema não pode ser alterado.',
      );
    }

    this.state = { ...this.state, name: next, updatedAt: now };
  }

  /**
   * Troca as permissões gravadas (InvalidPermissionError fora do catálogo).
   * O mesmo conjunto, em qualquer ordem, não muda nada.
   */
  setPermissions(permissions: readonly string[], now: Date): void {
    if (this.isOwner()) {
      throw new SystemRoleImmutableError(
        'As permissões do OWNER não podem ser alteradas.',
      );
    }

    const next = parsePermissions(permissions);
    const unchanged =
      next.length === this.granted.size &&
      next.every((permission) => this.granted.has(permission));
    if (unchanged) return;

    this.state = { ...this.state, permissions: next, updatedAt: now };
    this.granted = new Set(next);
  }

  /** Idempotente. Quem garante que ninguém usa o papel é o caso de uso. */
  softDelete(now: Date): void {
    if (this.isSystem()) {
      throw new SystemRoleImmutableError(
        'Papel de sistema não pode ser apagado.',
      );
    }
    if (this.isDeleted()) return;

    this.state = { ...this.state, deletedAt: now, updatedAt: now };
  }
}
