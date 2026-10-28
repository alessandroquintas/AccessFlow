/**
 * Uma carga por organização e requisição GraphQL: os campos de uma resposta
 * que pedem o mesmo dado de uma organização compartilham a mesma promessa.
 * A chave externa é o contexto GraphQL, novo a cada requisição.
 */
export class PerRequestCache<T> {
  private readonly byContext = new WeakMap<object, Map<string, Promise<T>>>();

  constructor(private readonly load: (organizationId: string) => Promise<T>) {}

  get(context: object, organizationId: string): Promise<T> {
    let byOrganization = this.byContext.get(context);
    if (!byOrganization) {
      byOrganization = new Map();
      this.byContext.set(context, byOrganization);
    }

    let value = byOrganization.get(organizationId);
    if (!value) {
      value = this.load(organizationId);
      byOrganization.set(organizationId, value);
    }
    return value;
  }
}
