import { DefaultRoles, Role, RoleSystemKey } from '../entities/role.entity';

export abstract class RoleRepository {
  /**
   * Papel pelo id, só se for da organização informada. Apagados ficam de
   * fora: um papel apagado não concede permissão nem pode ser atribuído.
   */
  abstract findById(organizationId: string, id: string): Promise<Role | null>;

  /** Papel de sistema da organização (toda organização tem os dois). */
  abstract findSystemRole(
    organizationId: string,
    systemKey: RoleSystemKey,
  ): Promise<Role | null>;

  /**
   * Papéis dos ids informados, apagados incluídos: serve para exibir o papel
   * de memberships e convites já gravados. A ordem não é garantida e ids
   * inexistentes são ignorados.
   */
  abstract findByIds(ids: string[]): Promise<Role[]>;

  /**
   * Papéis não apagados da organização, de sistema e customizados, sem
   * ordem garantida. São poucos: no máximo os dois de sistema mais
   * Role.MAX_CUSTOM_PER_ORGANIZATION.
   */
  abstract listActiveByOrganization(organizationId: string): Promise<Role[]>;

  /** Grava os papéis padrão de uma organização recém-criada, juntos. */
  abstract createDefaults(roles: DefaultRoles): Promise<void>;

  /** Grava um papel novo com as permissões dele, juntos. */
  abstract create(role: Role): Promise<void>;

  /**
   * Grava o que muda num papel existente: nome, permissões, `deletedAt` e
   * `updatedAt`. As permissões gravadas passam a ser exatamente as do papel.
   */
  abstract save(role: Role): Promise<void>;

  /**
   * Se algum membership ACTIVE ou convite PENDING (expirado ou não) aponta
   * para o papel. Lido de uma vez: um aceite, que troca o convite pelo
   * membership numa transação, nunca escapa entre as duas contagens.
   */
  abstract isInUse(roleId: string): Promise<boolean>;
}
