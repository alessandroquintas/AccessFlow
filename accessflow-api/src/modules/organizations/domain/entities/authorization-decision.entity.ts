import { randomUUID } from 'node:crypto';
import { PermissionDecision } from '../../policies/authorization';

export interface AuthorizationDecisionProps {
  id: string;
  organizationId: string;
  /** `client_id` da integração que perguntou. */
  clientId: string;
  /** Sobre quem se perguntou; pode nem existir como usuário. */
  subjectUserId: string;
  /** Na ordem do pedido, sem chaves repetidas. */
  results: readonly PermissionDecision[];
  decidedAt: Date;
}

/**
 * Uma resposta 200 do POST /v1/authorize, como foi dada. Só é gravada e
 * lida; o `allowed` sai dos resultados, nunca é informado à parte.
 */
export class AuthorizationDecision {
  private constructor(private readonly props: AuthorizationDecisionProps) {}

  static create(
    input: Omit<AuthorizationDecisionProps, 'id' | 'decidedAt'>,
    decidedAt: Date,
  ): AuthorizationDecision {
    return AuthorizationDecision.restore({
      ...input,
      id: randomUUID(),
      decidedAt,
    });
  }

  static restore(props: AuthorizationDecisionProps): AuthorizationDecision {
    if (!props.id?.trim()) throw new Error('AuthorizationDecision sem id.');
    if (!props.organizationId?.trim()) {
      throw new Error('AuthorizationDecision sem organizationId.');
    }
    if (!props.clientId?.trim()) {
      throw new Error('AuthorizationDecision sem clientId.');
    }
    if (!props.subjectUserId?.trim()) {
      throw new Error('AuthorizationDecision sem subjectUserId.');
    }
    assertValidResults(props.results);

    return new AuthorizationDecision({
      ...props,
      results: props.results.map(({ permission, allowed }) => ({
        permission,
        allowed,
      })),
    });
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get clientId(): string {
    return this.props.clientId;
  }
  get subjectUserId(): string {
    return this.props.subjectUserId;
  }
  get results(): readonly PermissionDecision[] {
    return this.props.results;
  }
  /** true só se todas as chaves forem permitidas. */
  get allowed(): boolean {
    return this.props.results.every((result) => result.allowed);
  }
  get decidedAt(): Date {
    return this.props.decidedAt;
  }
}

function assertValidResults(results: readonly PermissionDecision[]): void {
  // Vale também na leitura, em que o results vem do jsonb.
  if (!results?.length) {
    throw new Error('AuthorizationDecision sem resultados.');
  }
  const seen = new Set<string>();
  for (const result of results) {
    if (
      typeof result?.permission !== 'string' ||
      !result.permission ||
      typeof result.allowed !== 'boolean'
    ) {
      throw new Error('AuthorizationDecision com resultado malformado.');
    }
    if (seen.has(result.permission)) {
      throw new Error('AuthorizationDecision com chave repetida.');
    }
    seen.add(result.permission);
  }
}
