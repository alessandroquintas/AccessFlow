import { Injectable } from '@nestjs/common';
import { InvitationStatus as PrismaInvitationStatus } from '@prisma/client';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<Invitation | null> {
    const record = await this.prisma.invitation.findUnique({ where: { id } });
    return record ? PrismaInvitationMapper.toDomain(record) : null;
  }

  async savePending(
    candidate: Invitation,
    {
      maxPendingPerOrganization,
      now,
    }: { maxPendingPerOrganization: number; now: Date },
  ): Promise<Invitation> {
    return this.prisma.$transaction(async (tx) => {
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
            role: candidate.role,
            invitedByUserId: candidate.invitedByUserId,
          },
          now,
        );
        const { role, invitedByUserId, expiresAt, updatedAt } =
          PrismaInvitationMapper.toPersistence(existing);

        // Condicional: o aceite e a recusa não travam a organização, só o
        // convite. Se ele foi respondido depois da busca, cria-se um novo.
        const { count } = await tx.invitation.updateMany({
          where: { id: existing.id, status: PrismaInvitationStatus.PENDING },
          data: { role, invitedByUserId, expiresAt, updatedAt },
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
    // Um item a mais indica se existe próxima página, sem precisar de count.
    const records = await this.prisma.invitation.findMany({
      where: {
        organizationId,
        status: PrismaInvitationStatus.PENDING,
        ...(after && {
          OR: [
            { createdAt: { lt: after.createdAt } },
            { createdAt: after.createdAt, id: { lt: after.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: first + 1,
    });

    return {
      items: records.slice(0, first).map(PrismaInvitationMapper.toDomain),
      hasNextPage: records.length > first,
    };
  }

  async listPendingByEmail(email: string, now: Date): Promise<Invitation[]> {
    const records = await this.prisma.invitation.findMany({
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
    const { count } = await this.prisma.invitation.updateMany({
      where: { id: invitation.id, status: PrismaInvitationStatus.PENDING },
      data: { status, updatedAt },
    });
    if (count === 0) throw new InvitationNotFoundError();
  }

  async accept(invitation: Invitation, membership: Membership): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Trava o convite: um segundo aceite espera aqui e, ao seguir, já o
      // encontra ACCEPTED.
      const [locked] = await tx.$queryRaw<
        { status: PrismaInvitationStatus }[]
      >`SELECT status FROM invitations WHERE id = ${invitation.id}::uuid FOR UPDATE`;
      if (locked?.status !== PrismaInvitationStatus.PENDING) {
        throw new InvitationNotFoundError();
      }

      const data = PrismaMembershipMapper.toPersistence(membership);
      await tx.membership.upsert({
        where: {
          organizationId_userId: {
            organizationId: membership.organizationId,
            userId: membership.userId,
          },
        },
        create: data,
        update: {
          role: data.role,
          status: data.status,
          updatedAt: data.updatedAt,
        },
      });

      const { status, updatedAt } =
        PrismaInvitationMapper.toPersistence(invitation);
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status, updatedAt },
      });
    });
  }
}
