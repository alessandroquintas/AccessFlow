export abstract class UserDirectoryPort {
  /**
   * Devolve o id interno do usuário com perfil ativo para o sub informado.
   * Lança erro se o perfil não existir ou estiver inativo.
   */
  abstract getActiveUserId(cognitoSub: string): Promise<string>;
}
