import { Role } from '../../domain/entities/role.entity';

export interface AuthorizationSnapshot {
  /**
   * Membership ACTIVE do usuário na organização, ou null. `role` é null se o
   * papel não existir (a FK composta impede).
   */
  membership: { role: Role | null } | null;
  /** Das chaves pedidas, as que existem como personalizadas da organização. */
  customKeys: string[];
}

export abstract class AuthorizationSnapshotPort {
  /**
   * Tudo o que a decisão de autorização precisa, lido numa consulta só (um
   * snapshot): o membership ativo, o papel com todas as permissões dele e
   * quais das chaves pedidas existem no catálogo da organização. Sem trava.
   */
  abstract load(
    organizationId: string,
    userId: string,
    keys: readonly string[],
  ): Promise<AuthorizationSnapshot>;
}
