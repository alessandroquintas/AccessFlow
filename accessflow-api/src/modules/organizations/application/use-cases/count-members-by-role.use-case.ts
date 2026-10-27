import { MembershipRepository } from '../../domain/repositories/membership.repository';

/**
 * Membros ativos por papel de uma organização, numa consulta só. Não checa
 * acesso: serve para completar papéis que o usuário já recebeu por uma
 * operação autorizada (ex.: o `assignedRole` de um membro listado).
 */
export class CountMembersByRoleUseCase {
  constructor(private readonly memberships: MembershipRepository) {}

  execute(organizationId: string): Promise<Map<string, number>> {
    return this.memberships.countActiveByRole(organizationId);
  }
}
