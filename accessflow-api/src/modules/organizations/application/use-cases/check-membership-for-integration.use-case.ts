import { isUuid } from '@/shared/domain/uuid';
import { IntegrationClientRepository } from '../../domain/repositories/integration-client.repository';
import { MembershipRepository } from '../../domain/repositories/membership.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { MemberNotFoundError } from '../../domain/errors/member-not-found.error';
import { OrganizationNotFoundError } from '../../domain/errors/organization-not-found.error';
import { IntegrationMembership } from '../dto/integration-membership';
import { UserDirectoryPort } from '../ports/user-directory.port';

export interface CheckMembershipForIntegrationInput {
  /** `client_id` do token de máquina já verificado. */
  clientId: string;
  organizationId: string;
  userId: string;
}

export class CheckMembershipForIntegrationUseCase {
  constructor(
    private readonly integrationClients: IntegrationClientRepository,
    private readonly organizations: OrganizationRepository,
    private readonly memberships: MembershipRepository,
    private readonly roles: RoleRepository,
    private readonly users: UserDirectoryPort,
  ) {}

  async execute(
    input: CheckMembershipForIntegrationInput,
  ): Promise<IntegrationMembership> {
    // O Postgres compara UUID sem diferenciar maiúsculas; normalizar evita
    // recusar um id válido só por vir em maiúsculas de outro sistema.
    const organizationId = input.organizationId.toLowerCase();
    const userId = input.userId.toLowerCase();

    // Acesso primeiro: client desconhecido, revogado ou de outra organização
    // recebe a mesma resposta de organização inexistente.
    const client = await this.integrationClients.findByClientId(input.clientId);
    if (!client?.isActive() || client.organizationId !== organizationId) {
      throw new OrganizationNotFoundError();
    }

    if (!isUuid(organizationId)) throw new OrganizationNotFoundError();
    if (!isUuid(userId)) throw new MemberNotFoundError();

    const organization = await this.organizations.findById(organizationId);
    if (!organization?.isActive()) throw new OrganizationNotFoundError();

    const membership = await this.memberships.findByOrganizationAndUser(
      organizationId,
      userId,
    );
    if (!membership?.isActive()) throw new MemberNotFoundError();

    const [profile] = await this.users.getProfilesByIds([userId]);
    if (!profile?.active) throw new MemberNotFoundError();

    const role = await this.roles.findById(organizationId, membership.roleId);
    if (!role) throw new Error('Membership sem papel ativo na organização.');

    return {
      organizationId,
      userId,
      role,
      joinedAt: membership.createdAt,
    };
  }
}
