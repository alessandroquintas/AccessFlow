export interface MemberProfile {
  id: string;
  name: string;
  email: string;
  /** Falso quando o perfil do usuário está INACTIVE. */
  active: boolean;
}

export interface ActiveUser {
  id: string;
  /** Normalizado (minúsculas); veio verificado do Cognito. */
  email: string;
}

export abstract class UserDirectoryPort {
  /**
   * Devolve o id interno do usuário com perfil ativo para o sub informado.
   * Lança erro se o perfil não existir ou estiver inativo.
   */
  abstract getActiveUserId(cognitoSub: string): Promise<string>;

  /** Como `getActiveUserId`, mas devolve também o e-mail do perfil. */
  abstract getActiveUser(cognitoSub: string): Promise<ActiveUser>;

  /**
   * Ids dos perfis com o e-mail informado, ativos ou não.
   * - O e-mail não é único: a lista pode ter mais de um id, ou nenhum.
   * - Lança InvalidEmailError se o e-mail for inválido.
   */
  abstract getUserIdsByEmail(email: string): Promise<string[]>;

  /**
   * Devolve os perfis dos ids informados.
   * - A ordem do resultado não é garantida: indexe por `id`.
   * - Ids inexistentes são ignorados, sem erro.
   * - Usuários INACTIVE também são retornados.
   */
  abstract getProfilesByIds(ids: string[]): Promise<MemberProfile[]>;
}
