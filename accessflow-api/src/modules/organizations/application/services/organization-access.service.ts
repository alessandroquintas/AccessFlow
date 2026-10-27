import { OrganizationRepository } from '@/modules/organizations/domain/repositories/organization.repository';
import { MembershipRepository } from '@/modules/organizations/domain/repositories/membership.repository';
import { RoleRepository } from '@/modules/organizations/domain/repositories/role.repository';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { OrganizationWithMembership } from '../dto/organization-with-membership';
import { OrganizationPermission } from '../../policies/organization-permission';
import { OrganizationPermissionDeniedError } from '../../domain/errors/organization-permission-denied.error';
import { isUuid } from '@/shared/domain/uuid';

export class OrganizationAccessService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly memberships: MembershipRepository,
    private readonly roles: RoleRepository,
  ) {}

  /**
   * Garante que o usuário é membro ativo de uma organização ativa e devolve
   * também o papel dele. Qualquer falha vira OrganizationNotFoundError, para
   * não revelar a existência de organizações a quem não participa delas.
   */
  async requireMember(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationWithMembership> {
    if (!isUuid(organizationId)) throw new OrganizationNotFoundError();

    const membership = await this.memberships.findByOrganizationAndUser(
      organizationId,
      userId,
    );
    if (!membership?.isActive()) throw new OrganizationNotFoundError();

    const organization = await this.organizations.findById(organizationId);
    if (!organization?.isActive()) throw new OrganizationNotFoundError();

    // A FK composta garante o papel; só falta se ele estiver apagado, o que a
    // Fase 8b ainda vai definir. Até lá, falha fechada.
    const role = await this.roles.findById(organizationId, membership.roleId);
    if (!role) throw new Error('Membership sem papel ativo na organização.');

    return { organization, membership, role };
  }

  /**
   * Garante que o usuário é membro e que o papel dele concede a permissão.
   * Não membro: OrganizationNotFoundError. Membro sem permissão:
   * OrganizationPermissionDeniedError. Em escritas, chamar dentro da
   * transação, depois de travar a organização (OrganizationRepository.lock).
   */
  async requirePermission(
    organizationId: string,
    userId: string,
    permission: OrganizationPermission,
  ): Promise<OrganizationWithMembership> {
    const context = await this.requireMember(organizationId, userId);

    if (!context.role.grants(permission)) {
      throw new OrganizationPermissionDeniedError();
    }

    return context;
  }
}
