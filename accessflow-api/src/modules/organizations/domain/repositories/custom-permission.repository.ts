import { CustomPermission } from '../entities/custom-permission.entity';

export abstract class CustomPermissionRepository {
  /** Permissões personalizadas da organização, por chave. */
  abstract listByOrganization(
    organizationId: string,
  ): Promise<CustomPermission[]>;

  abstract findByKey(
    organizationId: string,
    key: string,
  ): Promise<CustomPermission | null>;

  /** Lança PermissionKeyTakenError se a chave já existir na organização. */
  abstract create(permission: CustomPermission): Promise<void>;

  /** Grava o que muda: descrição e `updatedAt`. */
  abstract save(permission: CustomPermission): Promise<void>;

  /**
   * Exclui de vez a permissão e as linhas dela em role_permissions de
   * papéis apagados da organização. Quem chama garante, com a organização
   * travada, que nenhum papel não apagado a tem (`isInUse`).
   */
  abstract delete(permission: CustomPermission): Promise<void>;

  /** Se algum papel NÃO apagado da organização concede a chave. */
  abstract isInUse(organizationId: string, key: string): Promise<boolean>;
}
