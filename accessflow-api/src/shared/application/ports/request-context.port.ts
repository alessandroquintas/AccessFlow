/** Dados da requisição em andamento, sem o código saber de HTTP nem de Nest. */
export abstract class RequestContextPort {
  /**
   * Id de correlação da requisição atual (o `X-Request-Id`). Fora de uma
   * requisição (ex.: um script de manutenção), undefined.
   *
   * Pode ter vindo do cliente: serve só para correlacionar resposta, logs e
   * registros, nunca para decisão de segurança, e pode se repetir entre
   * requisições.
   */
  abstract requestId(): string | undefined;
}
