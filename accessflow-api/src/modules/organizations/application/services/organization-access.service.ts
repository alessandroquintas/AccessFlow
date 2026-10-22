import { OrganizationRepository } from '@/modules/organizations/domain/repositories/organization.repository';
import { MembershipRepository } from '@/modules/organizations/domain/repositories/membership.repository';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { OrganizationWithMembership } from '../dto/organization-with-membership';
import { OrganizationPermission } from '../../policies/organization-permission';
import { OrganizationPermissionDeniedError } from '../../domain/errors/organization-permission-denied.error';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class OrganizationAccessService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly memberships: MembershipRepository,
  ) {}

  /**
   * Garante que o usuário é membro ativo de uma organização ativa.
   * Qualquer falha vira OrganizationNotFoundError, para não revelar
   * a existência de organizações a quem não participa delas.
   */
  async requireMember(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationWithMembership> {
    if (!UUID_PATTERN.test(organizationId))
      throw new OrganizationNotFoundError();

    const membership = await this.memberships.findByOrganizationAndUser(
      organizationId,
      userId,
    );
    if (!membership?.isActive()) throw new OrganizationNotFoundError();

    const organization = await this.organizations.findById(organizationId);
    if (!organization?.isActive()) throw new OrganizationNotFoundError();

    return { organization, membership };
  }

  /**
   * Garante que o usuário é membro e tem a permissão informada.
   * Não membro: OrganizationNotFoundError. Membro sem permissão: OrganizationPermissionDeniedError.
   */
  async requirePermission(
    organizationId: string,
    userId: string,
    permission: OrganizationPermission,
  ): Promise<OrganizationWithMembership> {
    const context = await this.requireMember(organizationId, userId);

    if (!context.membership.can(permission)) {
      throw new OrganizationPermissionDeniedError();
    }

    return context;
  }
}
