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

  /** Grava os papéis padrão de uma organização recém-criada, juntos. */
  abstract createDefaults(roles: DefaultRoles): Promise<void>;
}
