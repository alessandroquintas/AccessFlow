export interface MemberProfile {
  id: string;
  name: string;
  email: string;
}

export abstract class UserDirectoryPort {
  /**
   * Devolve o id interno do usuário com perfil ativo para o sub informado.
   * Lança erro se o perfil não existir ou estiver inativo.
   */
  abstract getActiveUserId(cognitoSub: string): Promise<string>;

  /**
   * Devolve os perfis dos ids informados.
   * - A ordem do resultado não é garantida: indexe por `id`.
   * - Ids inexistentes são ignorados, sem erro.
   * - Usuários INACTIVE também são retornados.
   */
  abstract getProfilesByIds(ids: string[]): Promise<MemberProfile[]>;
}
