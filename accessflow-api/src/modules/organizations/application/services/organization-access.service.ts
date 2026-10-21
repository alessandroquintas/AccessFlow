import { OrganizationRepository } from '@/modules/organizations/domain/repositories/organization.repository';
import { MembershipRepository } from '@/modules/organizations/domain/repositories/membership.repository';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { OrganizationWithMembership } from '../dto/organization-with-membership';

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
}
