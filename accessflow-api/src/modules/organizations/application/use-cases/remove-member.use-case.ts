import { isUuid } from '@/shared/domain/uuid';
import { MembershipRepository } from '../../domain/repositories/membership.repository';
import { CannotRemoveSelfError } from '../../domain/errors/cannot-remove-self.error';
import { MemberNotFoundError } from '../../domain/errors/member-not-found.error';
import { OrganizationPermission } from '../../policies/organization-permission';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';

export interface RemoveMemberInput {
  cognitoSub: string;
  organizationId: string;
  userId: string;
}

export class RemoveMemberUseCase {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
  ) {}

  async execute(input: RemoveMemberInput): Promise<void> {
    const actorId = await this.users.getActiveUserId(input.cognitoSub);

    // Limitação conhecida: a permissão do autor é checada fora da transação
    // do remove. Com 3 ou mais OWNERs, se o autor for removido no mesmo
    // instante em que remove outro membro, a ação dele ainda passa (a regra
    // do último OWNER continua garantida). Será tratado com o RBAC da Fase 8.
    await this.access.requirePermission(
      input.organizationId,
      actorId,
      OrganizationPermission.MEMBERS_REMOVE,
    );

    // O Postgres compara UUID sem diferenciar maiúsculas; sem normalizar,
    // o próprio id em maiúsculas escaparia da checagem abaixo.
    const targetUserId = input.userId.toLowerCase();

    if (targetUserId === actorId) {
      throw new CannotRemoveSelfError();
    }

    if (!isUuid(targetUserId)) {
      throw new MemberNotFoundError();
    }

    const target = await this.memberships.findByOrganizationAndUser(
      input.organizationId,
      targetUserId,
    );
    if (!target?.isActive()) {
      throw new MemberNotFoundError();
    }

    await this.memberships.remove(target);
  }
}
