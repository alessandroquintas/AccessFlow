import type { SecurityDenial } from '@/shared/domain/security-denial';

/** De onde veio a negação: o que só a camada de apresentação sabe. */
export interface DenialOrigin {
  /** GraphQL: o campo da operação, ex.: `createRole`. */
  operation?: string;
  /** HTTP: método e caminho declarado da rota, ex.: `GET /v1/authorize`. */
  route?: string;
  /** `sub` do usuário autenticado, quando a requisição é de usuário. */
  userSub?: string;
}

/** Grava negações de acesso como eventos de segurança. */
export abstract class SecurityDenialRecorder {
  /**
   * Grava a negação. Chamar só depois que a transação da ação terminou: a
   * negação a desfaz, e o evento tem de ficar.
   */
  abstract record(denial: SecurityDenial, origin: DenialOrigin): Promise<void>;
}
