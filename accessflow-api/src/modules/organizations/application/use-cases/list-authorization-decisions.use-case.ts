import { isUuid } from '@/shared/domain/uuid';
import {
  AuthorizationDecisionCursor,
  AuthorizationDecisionFilter,
  AuthorizationDecisionLog,
  AuthorizationDecisionPage,
} from '../../domain/repositories/authorization-decision-log.repository';
import { PermissionKey } from '../../domain/value-objects/permission-key.vo';
import { OrganizationPermission } from '../../policies/organization-permission';
import { InvalidAuditFilterError } from '../errors/invalid-audit-filter.error';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';

/** O filtro como chega de fora, ainda sem validar. */
export interface ListAuthorizationDecisionsFilterInput {
  subjectUserId?: string;
  clientId?: string;
  allowed?: boolean;
  permission?: string;
  decidedFrom?: Date;
  decidedTo?: Date;
}

export interface ListAuthorizationDecisionsInput {
  cognitoSub: string;
  organizationId: string;
  first: number;
  after?: AuthorizationDecisionCursor;
  filter?: ListAuthorizationDecisionsFilterInput;
}

export class ListAuthorizationDecisionsUseCase {
  constructor(
    private readonly decisions: AuthorizationDecisionLog,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
  ) {}

  /** Da mais recente para a mais antiga. Exige audit:read. */
  async execute(
    input: ListAuthorizationDecisionsInput,
  ): Promise<AuthorizationDecisionPage> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);
    // Antes do acesso, como o cursor: o 400 não depende da organização.
    const filter = parseFilter(input.filter ?? {});
    const organizationId = input.organizationId.toLowerCase();

    await this.access.requirePermission(
      organizationId,
      userId,
      OrganizationPermission.AUDIT_READ,
    );

    return this.decisions.listByOrganization(organizationId, {
      first: input.first,
      after: input.after,
      filter,
    });
  }
}

/**
 * Valida e normaliza o filtro, com o mesmo erro do filtro da trilha:
 * subjectUserId que não é UUID, chave fora do formato recurso:ação e período
 * invertido são INVALID_AUDIT_FILTER. A chave não precisa existir no
 * catálogo: a personalizada apagada continua nas decisões antigas.
 */
function parseFilter(
  input: ListAuthorizationDecisionsFilterInput,
): AuthorizationDecisionFilter {
  const subjectUserId = input.subjectUserId?.toLowerCase();
  if (subjectUserId !== undefined && !isUuid(subjectUserId)) {
    throw new InvalidAuditFilterError('subjectUserId deve ser um UUID.');
  }

  if (
    input.permission !== undefined &&
    !PermissionKey.isValid(input.permission)
  ) {
    throw new InvalidAuditFilterError(
      'permission deve ter o formato recurso:ação.',
    );
  }

  const { decidedFrom, decidedTo } = input;
  if (decidedFrom && decidedTo && decidedFrom > decidedTo) {
    throw new InvalidAuditFilterError(
      'decidedFrom não pode ser depois de decidedTo.',
    );
  }

  return {
    subjectUserId,
    clientId: input.clientId,
    allowed: input.allowed,
    permission: input.permission,
    decidedFrom,
    decidedTo,
  };
}
