import { DomainError } from '@/shared/domain/errors/domain.error';

/** Nenhuma rota HTTP casa com o método e o caminho pedidos. */
export class RouteNotFoundError extends DomainError {
  readonly code = 'ROUTE_NOT_FOUND';

  constructor() {
    super('Rota não encontrada.');
  }
}
