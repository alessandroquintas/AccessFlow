import { MembershipRepository } from '../../domain/repositories/membership.repository';

/**
 * Membros ativos por papel de uma organização, numa consulta só. Não checa
 * acesso. Hoje só o memberCount de `viewerAssignedRole` chega aqui: o papel
 * do próprio usuário numa organização da qual ele é membro ativo
 * (organization, myOrganizations, createOrganization, updateOrganization e
 * acceptInvitation). As operações de papel já trazem a contagem, depois de
 * checar roles:read ou roles:manage. Membros e convites expõem só
 * RoleSummary, sem contagem: antes de devolver OrganizationRole em outro
 * caminho, garanta que o viewer pode ver a contagem.
 */
export class CountMembersByRoleUseCase {
  constructor(private readonly memberships: MembershipRepository) {}

  execute(organizationId: string): Promise<Map<string, number>> {
    return this.memberships.countActiveByRole(organizationId);
  }
}
