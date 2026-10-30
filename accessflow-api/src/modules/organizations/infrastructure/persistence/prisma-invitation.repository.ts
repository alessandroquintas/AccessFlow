import { Injectable } from '@nestjs/common';
import {
  Prisma,
  InvitationStatus as PrismaInvitationStatus,
  type Invitation as PrismaInvitation,
} from '@prisma/client';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { Invitation } from '@/modules/organizations/domain/entities/invitation.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { InvitationNotFoundError } from '@/modules/organizations/domain/errors/invitation-not-found.error';
import { InvitationLimitReachedError } from '@/modules/organizations/domain/errors/invitation-limit-reached.error';
import {
  InvitationCursor,
  InvitationPage,
  InvitationRepository,
} from '@/modules/organizations/domain/repositories/invitation.repository';
import { PrismaInvitationMapper } from './mappers/prisma-invitation.mapper';
import { PrismaMembershipMapper } from './mappers/prisma-membership.mapper';

@Injectable()
export class PrismaInvitationRepository extends InvitationRepository {
  constructor(
    private readonly clients: PrismaClientProvider,
    private readonly transactions: TransactionManager,
  ) {
    super();
  }

  async findById(id: string): Promise<Invitation | null> {
    const record = await this.clients.current().invitation.findUnique({
      where: { id },
    });
    return record ? PrismaInvitationMapper.toDomain(record) : null;
  }

  async findPending(
    organizationId: string,
    email: string,
  ): Promise<Invitation | null> {
    const record = await this.clients.current().invitation.findFirst({
      where: { organizationId, email, status: PrismaInvitationStatus.PENDING },
    });
    return record ? PrismaInvitationMapper.toDomain(record) : null;
  }

  async savePending(
    candidate: Invitation,
    {
      maxPendingPerOrganization,
      now,
    }: { maxPendingPerOrganization: number; now: Date },
  ): Promise<Invitation> {
    return this.transactions.run(async () => {
      const tx = this.clients.current();
      // Trava a organização: convites concorrentes nela esperam aqui, então
      // a busca do pendente e a contagem do limite não correm em paralelo.
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${candidate.organizationId}::uuid FOR UPDATE`;

      const record = await tx.invitation.findFirst({
        where: {
          organizationId: candidate.organizationId,
          email: candidate.email,
          status: PrismaInvitationStatus.PENDING,
        },
      });

      if (record) {
        const existing = PrismaInvitationMapper.toDomain(record);
        existing.renew(
          {
            roleId: candidate.roleId,
            invitedByUserId: candidate.invitedByUserId,
          },
          now,
        );
        const { roleId, invitedByUserId, expiresAt, updatedAt } =
          PrismaInvitationMapper.toPersistence(existing);

        // Condicional: o aceite e a recusa não travam a organização, só o
        // convite. Se ele foi respondido depois da busca, cria-se um novo.
        const { count } = await tx.invitation.updateMany({
          where: { id: existing.id, status: PrismaInvitationStatus.PENDING },
          data: { roleId, invitedByUserId, expiresAt, updatedAt },
        });
        if (count === 1) return existing;
      }

      // Expirados ficam na listagem, mas não ocupam vaga no limite.
      const pending = await tx.invitation.count({
        where: {
          organizationId: candidate.organizationId,
          status: PrismaInvitationStatus.PENDING,
          expiresAt: { gt: now },
        },
      });
      if (pending >= maxPendingPerOrganization) {
        throw new InvitationLimitReachedError();
      }

      await tx.invitation.create({
        data: PrismaInvitationMapper.toPersistence(candidate),
      });
      return candidate;
    });
  }

  async listPendingByOrganization(
    organizationId: string,
    { first, after }: { first: number; after?: InvitationCursor },
  ): Promise<InvitationPage> {
    // Comparação de linha, como no auditEvents, e não o OR de antes: o
    // cursor entra no Index Cond de (organization_id, status, created_at, id)
    // e a página começa direto nele.
    const cursor = after
      ? Prisma.sql`AND (created_at, id) < (${after.createdAt}::timestamptz, ${after.id}::uuid)`
      : Prisma.empty;

    // Um item a mais indica se existe próxima página, sem precisar de count.
    const records = await this.clients.current().$queryRaw<PrismaInvitation[]>`
      SELECT id,
             organization_id AS "organizationId",
             email,
             role_id AS "roleId",
             status,
             invited_by_user_id AS "invitedByUserId",
             expires_at AS "expiresAt",
             created_at AS "createdAt",
             updated_at AS "updatedAt"
      FROM invitations
      WHERE organization_id = ${organizationId}::uuid
        AND status = ${PrismaInvitationStatus.PENDING}::"InvitationStatus"
        ${cursor}
      ORDER BY created_at DESC, id DESC
      LIMIT ${first + 1}`;

    return {
      items: records.slice(0, first).map(PrismaInvitationMapper.toDomain),
      hasNextPage: records.length > first,
    };
  }

  async listPendingByEmail(email: string, now: Date): Promise<Invitation[]> {
    const records = await this.clients.current().invitation.findMany({
      where: {
        email,
        status: PrismaInvitationStatus.PENDING,
        expiresAt: { gt: now },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return records.map(PrismaInvitationMapper.toDomain);
  }

  async respond(invitation: Invitation): Promise<void> {
    const { status, updatedAt } =
      PrismaInvitationMapper.toPersistence(invitation);

    // Só muda se ainda estiver PENDING: duas respostas simultâneas não se
    // sobrescrevem, e a segunda recebe "não encontrado".
    const { count } = await this.clients.current().invitation.updateMany({
      where: { id: invitation.id, status: PrismaInvitationStatus.PENDING },
      data: { status, updatedAt },
    });
    if (count === 0) throw new InvitationNotFoundError();
  }

  async accept(
    invitation: Invitation,
    { userId, now }: { userId: string; now: Date },
  ): Promise<Membership> {
    const { organizationId } = invitation;

    return this.transactions.run(async () => {
      const tx = this.clients.current();
      // Trava o convite: um segundo aceite espera aqui e, ao seguir, já o
      // encontra ACCEPTED.
      const [locked] = await tx.$queryRaw<
        { status: PrismaInvitationStatus }[]
      >`SELECT status FROM invitations WHERE id = ${invitation.id}::uuid FOR UPDATE`;
      if (locked?.status !== PrismaInvitationStatus.PENDING) {
        throw new InvitationNotFoundError();
      }

      // Decide com o estado lido aqui, e não com o que o caso de uso viu
      // antes: uma remoção que terminou nesse intervalo já aparece.
      const record = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });

      let membership: Membership;
      if (!record) {
        membership = Membership.create(
          { organizationId, userId, roleId: invitation.roleId },
          now,
        );
        await tx.membership.create({
          data: PrismaMembershipMapper.toPersistence(membership),
        });
      } else {
        membership = PrismaMembershipMapper.toDomain(record);
        // Já é membro ativo: o convite é consumido e o papel não muda.
        if (!membership.isActive()) {
          membership.reactivate(invitation.roleId, now);
          const { roleId, status, updatedAt } =
            PrismaMembershipMapper.toPersistence(membership);
          await tx.membership.update({
            where: { id: membership.id },
            data: { roleId, status, updatedAt },
          });
        }
      }

      const { status, updatedAt } =
        PrismaInvitationMapper.toPersistence(invitation);
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status, updatedAt },
      });

      return membership;
    });
  }
}
