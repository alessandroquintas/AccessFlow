import { isUuid } from '@/shared/domain/uuid';
import { ClockPort } from '@/shared/application/ports/clock.port';
import { AuthorizationDecision } from '../../domain/entities/authorization-decision.entity';
import { InvalidPermissionKeyError } from '../../domain/errors/invalid-permission-key.error';
import { OrganizationNotFoundError } from '../../domain/errors/organization-not-found.error';
import { AuthorizationDecisionLog } from '../../domain/repositories/authorization-decision-log.repository';
import { IntegrationClientRepository } from '../../domain/repositories/integration-client.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { PermissionKey } from '../../domain/value-objects/permission-key.vo';
import { decidePermissions } from '../../policies/authorization';
import { PermissionCatalog } from '../../policies/organization-permission';
import { IntegrationAuthorization } from '../dto/integration-authorization';
import { InvalidAuthorizationRequestError } from '../errors/invalid-authorization-request.error';
import { AuthorizationSnapshotPort } from '../ports/authorization-snapshot.port';
import { UserDirectoryPort } from '../ports/user-directory.port';

/** Chaves por pedido, contadas antes de tirar as repetidas. */
export const MAX_AUTHORIZE_PERMISSIONS = 25;

export interface AuthorizeForIntegrationInput {
  /** `client_id` do token de máquina já verificado. */
  clientId: string;
  organizationId: string;
  userId: string;
  permissions: string[];
}

export class AuthorizeForIntegrationUseCase {
  constructor(
    private readonly integrationClients: IntegrationClientRepository,
    private readonly organizations: OrganizationRepository,
    private readonly snapshots: AuthorizationSnapshotPort,
    private readonly users: UserDirectoryPort,
    private readonly decisions: AuthorizationDecisionLog,
    private readonly clock: ClockPort,
  ) {}

  /**
   * Não membro, membro removido e conta desativada recebem a mesma resposta
   * de membro sem a permissão: tudo false. Sem trava: só leituras e, no fim,
   * o registro da decisão.
   */
  async execute(
    input: AuthorizeForIntegrationInput,
  ): Promise<IntegrationAuthorization> {
    const organizationId = input.organizationId.toLowerCase();
    const userId = input.userId.toLowerCase();

    // Formato primeiro: o 400 não depende do client nem da organização.
    if (!isUuid(organizationId)) {
      throw new InvalidAuthorizationRequestError(
        'organizationId deve ser um UUID.',
      );
    }
    if (!isUuid(userId)) {
      throw new InvalidAuthorizationRequestError('userId deve ser um UUID.');
    }
    const permissions = parseRequestedPermissions(input.permissions);

    // Acesso: a mesma regra do GET de membros. Client desconhecido, revogado
    // ou de outra organização recebe a resposta de organização inexistente,
    // e a negação vira evento de segurança.
    const client = await this.integrationClients.findByClientId(input.clientId);
    if (!client?.isActive() || client.organizationId !== organizationId) {
      throw OrganizationNotFoundError.outsideClientBinding(input.clientId);
    }
    const organization = await this.organizations.findById(organizationId);
    if (!organization?.isActive()) throw new OrganizationNotFoundError();

    // Conta desativada no identity vale como não membro, como no GET de
    // membros: nem lê o snapshot.
    const [profile] = await this.users.getProfilesByIds([userId]);
    const snapshot = profile?.active
      ? await this.snapshots.load(organizationId, userId, permissions)
      : null;

    const membership = snapshot?.membership ?? null;
    if (membership && (!membership.role || membership.role.isDeleted())) {
      // Falha fechada, como o requireMember: a FK e o ROLE_IN_USE impedem.
      throw new Error('Membership sem papel ativo na organização.');
    }

    // O catálogo efetivo, restrito ao que importa aqui: o de sistema mais as
    // personalizadas pedidas que existem na organização.
    const results = decidePermissions(
      membership?.role ?? null,
      PermissionCatalog.withCustom(snapshot?.customKeys ?? []),
      permissions,
    );

    // Falha fechada: se o registro não for gravado, o erro sobe e a resposta
    // é o 500, nunca uma decisão sem registro.
    const decision = AuthorizationDecision.create(
      {
        organizationId,
        clientId: input.clientId,
        subjectUserId: userId,
        results,
      },
      this.clock.now(),
    );
    await this.decisions.record(decision);

    return {
      organizationId,
      userId,
      allowed: decision.allowed,
      results,
    };
  }
}

/** De 1 a 25 chaves no formato recurso:ação; devolve sem repetidas, na ordem. */
function parseRequestedPermissions(permissions: readonly string[]): string[] {
  if (
    permissions.length < 1 ||
    permissions.length > MAX_AUTHORIZE_PERMISSIONS
  ) {
    throw new InvalidAuthorizationRequestError(
      `permissions deve ter de 1 a ${MAX_AUTHORIZE_PERMISSIONS} itens.`,
    );
  }

  for (const key of permissions) {
    if (!PermissionKey.isValid(key)) {
      throw new InvalidPermissionKeyError(
        `Chave fora do formato recurso:ação: "${key}".`,
      );
    }
  }

  return [...new Set(permissions)];
}
