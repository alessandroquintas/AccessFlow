import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import {
  Membership,
  MembershipRole,
} from '@/modules/organizations/domain/entities/membership.entity';
import {
  Invitation,
  InvitationStatus,
} from '@/modules/organizations/domain/entities/invitation.entity';
import { InvitationNotFoundError } from '@/modules/organizations/domain/errors/invitation-not-found.error';
import { InvitationLimitReachedError } from '@/modules/organizations/domain/errors/invitation-limit-reached.error';
import { PrismaOrganizationRepository } from '@/modules/organizations/infrastructure/persistence/prisma-organization.repository';
import { PrismaInvitationRepository } from '@/modules/organizations/infrastructure/persistence/prisma-invitation.repository';
import { PrismaInvitationMapper } from '@/modules/organizations/infrastructure/persistence/mappers/prisma-invitation.mapper';
import { PrismaMembershipMapper } from '@/modules/organizations/infrastructure/persistence/mappers/prisma-membership.mapper';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-03-01T12:00:00.000Z');
const at = (ms: number) => new Date(NOW.getTime() + ms);
const limitAt = (now = NOW) => ({ maxPendingPerOrganization: 50, now });

let prisma: PrismaService;
let organizations: PrismaOrganizationRepository;
let invitations: PrismaInvitationRepository;

async function createUser(
  cognitoSub: string,
  email = `${cognitoSub}@example.com`,
) {
  return prisma.user.create({ data: { cognitoSub, name: 'Usuário', email } });
}

async function createOrganizationWithOwner(slug: string, ownerId: string) {
  const organization = Organization.create({ name: 'Acme', slug });
  await organizations.createWithOwner(
    organization,
    Membership.createOwner(organization.id, ownerId),
  );
  return organization;
}

function makeInvitation(
  organizationId: string,
  invitedByUserId: string,
  email: string,
  now = NOW,
  role: MembershipRole = MembershipRole.MEMBER,
) {
  return Invitation.create(
    { organizationId, email, role, invitedByUserId },
    now,
  );
}

async function insert(...items: Invitation[]) {
  await prisma.invitation.createMany({
    data: items.map(PrismaInvitationMapper.toPersistence),
  });
}

/**
 * Abre conexões no pool antes da corrida. Sem isso, a segunda transação
 * espera uma conexão nova e só começa depois que a primeira terminou, e o
 * teste passaria mesmo sem a trava.
 */
async function warmPool() {
  await Promise.all(
    Array.from({ length: 4 }, () => prisma.$queryRaw`SELECT 1`),
  );
}

describe('PrismaInvitationRepository (integração)', () => {
  let ana: { id: string };
  let acme: Organization;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    organizations = new PrismaOrganizationRepository(prisma);
    invitations = new PrismaInvitationRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "memberships", "organizations", "users" CASCADE`;
    ana = await createUser('sub-ana');
    acme = await createOrganizationWithOwner('acme', ana.id);
  });

  it('findById devolve o convite gravado ou null', async () => {
    const invitation = makeInvitation(acme.id, ana.id, 'bruno@example.com');
    await insert(invitation);

    const found = await invitations.findById(invitation.id);

    expect(found?.email).toBe('bruno@example.com');
    expect(found?.status).toBe(InvitationStatus.PENDING);
    expect(found?.expiresAt).toEqual(at(7 * DAY));
    expect(await invitations.findById(crypto.randomUUID())).toBeNull();
  });

  describe('savePending', () => {
    it('cria o convite quando não há pendente para o e-mail', async () => {
      const candidate = makeInvitation(acme.id, ana.id, 'bruno@example.com');

      const saved = await invitations.savePending(candidate, limitAt());

      expect(saved.id).toBe(candidate.id);
      expect(await prisma.invitation.count()).toBe(1);
    });

    it('renova o pendente: mesmo id, novo papel, novo autor e nova expiração', async () => {
      const carla = await createUser('sub-carla');
      const first = makeInvitation(acme.id, ana.id, 'bruno@example.com');
      await insert(first);

      const renewed = await invitations.savePending(
        makeInvitation(
          acme.id,
          carla.id,
          'bruno@example.com',
          at(2 * DAY),
          MembershipRole.OWNER,
        ),
        limitAt(at(2 * DAY)),
      );

      expect(renewed.id).toBe(first.id);
      const record = await prisma.invitation.findUniqueOrThrow({
        where: { id: first.id },
      });
      expect(record).toMatchObject({
        role: 'OWNER',
        invitedByUserId: carla.id,
        expiresAt: at(9 * DAY),
        updatedAt: at(2 * DAY),
        createdAt: NOW,
        status: 'PENDING',
      });
      expect(await prisma.invitation.count()).toBe(1);
    });

    it('renova também um pendente já expirado', async () => {
      const first = makeInvitation(acme.id, ana.id, 'bruno@example.com');
      await insert(first);

      const renewed = await invitations.savePending(
        makeInvitation(acme.id, ana.id, 'bruno@example.com', at(30 * DAY)),
        limitAt(at(30 * DAY)),
      );

      expect(renewed.id).toBe(first.id);
      expect(renewed.expiresAt).toEqual(at(37 * DAY));
    });

    it('cria outro convite quando o anterior já foi respondido', async () => {
      const declined = makeInvitation(acme.id, ana.id, 'bruno@example.com');
      declined.decline(at(DAY));
      await insert(declined);

      const saved = await invitations.savePending(
        makeInvitation(acme.id, ana.id, 'bruno@example.com', at(2 * DAY)),
        limitAt(at(2 * DAY)),
      );

      expect(saved.id).not.toBe(declined.id);
      expect(await prisma.invitation.count()).toBe(2);
    });

    describe('limite de pendentes', () => {
      async function fillToLimit(createdAt = NOW, count = 50) {
        await insert(
          ...Array.from({ length: count }, (_, i) =>
            makeInvitation(
              acme.id,
              ana.id,
              `pessoa-${i}@example.com`,
              createdAt,
            ),
          ),
        );
      }

      it('recusa o 51º convite pendente e não grava nada', async () => {
        await fillToLimit();

        await expect(
          invitations.savePending(
            makeInvitation(acme.id, ana.id, 'novo@example.com'),
            limitAt(),
          ),
        ).rejects.toBeInstanceOf(InvitationLimitReachedError);
        expect(await prisma.invitation.count()).toBe(50);
      });

      it('50 convites expirados não impedem um convite novo', async () => {
        await fillToLimit(at(-30 * DAY));

        const saved = await invitations.savePending(
          makeInvitation(acme.id, ana.id, 'novo@example.com'),
          limitAt(),
        );

        expect(saved.email).toBe('novo@example.com');
        // Os expirados continuam gravados como PENDING.
        expect(
          await prisma.invitation.count({ where: { status: 'PENDING' } }),
        ).toBe(51);
      });

      it('expirados não ocupam vaga: com 49 válidos, aceita o 50º e recusa o 51º', async () => {
        await fillToLimit(at(-30 * DAY), 10);
        await insert(
          ...Array.from({ length: 49 }, (_, i) =>
            makeInvitation(acme.id, ana.id, `valido-${i}@example.com`),
          ),
        );

        await invitations.savePending(
          makeInvitation(acme.id, ana.id, 'quinquagesimo@example.com'),
          limitAt(),
        );

        await expect(
          invitations.savePending(
            makeInvitation(acme.id, ana.id, 'excedente@example.com'),
            limitAt(),
          ),
        ).rejects.toBeInstanceOf(InvitationLimitReachedError);
      });

      it('um convite deixa de ocupar vaga no instante em que expira', async () => {
        await fillToLimit();
        const now = at(7 * DAY);

        const saved = await invitations.savePending(
          makeInvitation(acme.id, ana.id, 'novo@example.com', now),
          limitAt(now),
        );

        expect(saved.email).toBe('novo@example.com');
      });

      it('renovar no limite continua permitido', async () => {
        await fillToLimit();

        const renewed = await invitations.savePending(
          makeInvitation(acme.id, ana.id, 'pessoa-7@example.com', at(DAY)),
          limitAt(at(DAY)),
        );

        expect(renewed.expiresAt).toEqual(at(8 * DAY));
        expect(await prisma.invitation.count()).toBe(50);
      });

      it('respondidos e convites de outra organização não contam', async () => {
        const beta = await createOrganizationWithOwner('beta', ana.id);
        const answered = (['accept', 'decline', 'revoke'] as const).map(
          (method) => {
            const invitation = makeInvitation(
              acme.id,
              ana.id,
              `${method}@example.com`,
            );
            invitation[method](NOW);
            return invitation;
          },
        );
        await insert(
          ...answered,
          ...Array.from({ length: 49 }, (_, i) =>
            makeInvitation(acme.id, ana.id, `pessoa-${i}@example.com`),
          ),
          ...Array.from({ length: 5 }, (_, i) =>
            makeInvitation(beta.id, ana.id, `beta-${i}@example.com`),
          ),
        );

        await invitations.savePending(
          makeInvitation(acme.id, ana.id, 'quinquagesimo@example.com'),
          limitAt(),
        );

        await expect(
          invitations.savePending(
            makeInvitation(acme.id, ana.id, 'excedente@example.com'),
            limitAt(),
          ),
        ).rejects.toBeInstanceOf(InvitationLimitReachedError);
      });
    });

    it('concorrência: dois convites simultâneos para o mesmo e-mail viram UMA linha', async () => {
      await warmPool();

      const results = await Promise.allSettled([
        invitations.savePending(
          makeInvitation(acme.id, ana.id, 'bruno@example.com'),
          limitAt(),
        ),
        invitations.savePending(
          makeInvitation(
            acme.id,
            ana.id,
            'bruno@example.com',
            NOW,
            MembershipRole.OWNER,
          ),
          limitAt(),
        ),
      ]);

      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
      const [first, second] = results.map(
        (r) => (r as PromiseFulfilledResult<Invitation>).value,
      );
      expect(first.id).toBe(second.id);
      expect(
        await prisma.invitation.count({
          where: { organizationId: acme.id, email: 'bruno@example.com' },
        }),
      ).toBe(1);
    });
  });

  describe('listPendingByOrganization', () => {
    it('pagina dos mais recentes para os mais antigos, inclui expirados e desempata pelo id', async () => {
      const beta = await createOrganizationWithOwner('beta', ana.id);
      const expired = makeInvitation(
        acme.id,
        ana.id,
        'velho@example.com',
        at(-30 * DAY),
      );
      const sameTime = [
        makeInvitation(acme.id, ana.id, 'b@example.com', at(DAY)),
        makeInvitation(acme.id, ana.id, 'c@example.com', at(DAY)),
      ].sort((a, b) => (a.id < b.id ? 1 : -1));
      const newest = makeInvitation(
        acme.id,
        ana.id,
        'novo@example.com',
        at(2 * DAY),
      );
      const revoked = makeInvitation(
        acme.id,
        ana.id,
        'revogado@example.com',
        at(3 * DAY),
      );
      revoked.revoke(at(3 * DAY));
      const otherOrganization = makeInvitation(
        beta.id,
        ana.id,
        'beta@example.com',
        at(4 * DAY),
      );
      await insert(expired, ...sameTime, newest, revoked, otherOrganization);

      const first = await invitations.listPendingByOrganization(acme.id, {
        first: 2,
      });
      const last = first.items.at(-1)!;
      const second = await invitations.listPendingByOrganization(acme.id, {
        first: 2,
        after: { createdAt: last.createdAt, id: last.id },
      });

      expect(first.hasNextPage).toBe(true);
      expect(second.hasNextPage).toBe(false);
      expect([...first.items, ...second.items].map((i) => i.id)).toEqual([
        newest.id,
        sameTime[0].id,
        sameTime[1].id,
        expired.id,
      ]);
    });
  });

  describe('listPendingByEmail', () => {
    it('devolve só pendentes não expirados do e-mail, de qualquer organização', async () => {
      const beta = await createOrganizationWithOwner('beta', ana.id);
      const gama = await createOrganizationWithOwner('gama', ana.id);
      const fromAcme = makeInvitation(acme.id, ana.id, 'bruno@example.com');
      const fromBeta = makeInvitation(
        beta.id,
        ana.id,
        'bruno@example.com',
        at(DAY),
      );
      const expired = makeInvitation(
        gama.id,
        ana.id,
        'bruno@example.com',
        at(-8 * DAY),
      );
      const declined = makeInvitation(
        gama.id,
        ana.id,
        'bruno@example.com',
        at(-DAY),
      );
      declined.decline(NOW);
      const otherEmail = makeInvitation(acme.id, ana.id, 'carla@example.com');
      await insert(fromAcme, fromBeta, expired, declined, otherEmail);

      const found = await invitations.listPendingByEmail(
        'bruno@example.com',
        at(2 * DAY),
      );

      expect(found.map((i) => i.id)).toEqual([fromBeta.id, fromAcme.id]);
    });

    it('um convite deixa de aparecer no instante em que expira', async () => {
      await insert(makeInvitation(acme.id, ana.id, 'bruno@example.com'));

      expect(
        await invitations.listPendingByEmail(
          'bruno@example.com',
          at(7 * DAY - 1),
        ),
      ).toHaveLength(1);
      expect(
        await invitations.listPendingByEmail('bruno@example.com', at(7 * DAY)),
      ).toHaveLength(0);
    });
  });

  describe('respond', () => {
    it('grava a recusa', async () => {
      const invitation = makeInvitation(acme.id, ana.id, 'bruno@example.com');
      await insert(invitation);

      invitation.decline(at(DAY));
      await invitations.respond(invitation);

      const record = await prisma.invitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      expect(record.status).toBe('DECLINED');
      expect(record.updatedAt).toEqual(at(DAY));
    });

    it('só grava se ainda estiver PENDING no banco', async () => {
      const invitation = makeInvitation(acme.id, ana.id, 'bruno@example.com');
      await insert(invitation);
      const stale = (await invitations.findById(invitation.id))!;

      invitation.revoke(at(DAY));
      await invitations.respond(invitation);

      stale.decline(at(2 * DAY));
      await expect(invitations.respond(stale)).rejects.toBeInstanceOf(
        InvitationNotFoundError,
      );
      const record = await prisma.invitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      expect(record.status).toBe('REVOKED');
      expect(record.updatedAt).toEqual(at(DAY));
    });

    it('convite inexistente lança InvitationNotFoundError', async () => {
      const invitation = makeInvitation(acme.id, ana.id, 'bruno@example.com');
      invitation.decline(at(DAY));

      await expect(invitations.respond(invitation)).rejects.toBeInstanceOf(
        InvitationNotFoundError,
      );
    });
  });

  describe('accept', () => {
    it('cria o membership com o papel do convite e marca como aceito', async () => {
      const bruno = await createUser('sub-bruno');
      const invitation = makeInvitation(
        acme.id,
        ana.id,
        'sub-bruno@example.com',
        NOW,
        MembershipRole.OWNER,
      );
      await insert(invitation);

      invitation.accept(at(DAY));
      await invitations.accept(
        invitation,
        Membership.create(
          { organizationId: acme.id, userId: bruno.id, role: invitation.role },
          at(DAY),
        ),
      );

      const membership = await prisma.membership.findUniqueOrThrow({
        where: {
          organizationId_userId: { organizationId: acme.id, userId: bruno.id },
        },
      });
      expect(membership).toMatchObject({ role: 'OWNER', status: 'ACTIVE' });
      expect(
        (
          await prisma.invitation.findUniqueOrThrow({
            where: { id: invitation.id },
          })
        ).status,
      ).toBe('ACCEPTED');
    });

    it('reativa o membership REMOVED com o papel do convite, sem criar outro', async () => {
      const bruno = await createUser('sub-bruno');
      const old = Membership.create(
        {
          organizationId: acme.id,
          userId: bruno.id,
          role: MembershipRole.OWNER,
        },
        at(-10 * DAY),
      );
      old.remove(at(-5 * DAY));
      await prisma.membership.create({
        data: PrismaMembershipMapper.toPersistence(old),
      });
      const invitation = makeInvitation(
        acme.id,
        ana.id,
        'sub-bruno@example.com',
      );
      await insert(invitation);

      invitation.accept(at(DAY));
      old.reactivate(invitation.role, at(DAY));
      await invitations.accept(invitation, old);

      const records = await prisma.membership.findMany({
        where: { organizationId: acme.id, userId: bruno.id },
      });
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        id: old.id,
        role: 'MEMBER',
        status: 'ACTIVE',
        updatedAt: at(DAY),
        createdAt: at(-10 * DAY),
      });
    });

    it('convite que já não está PENDING não cria membership', async () => {
      const bruno = await createUser('sub-bruno');
      const invitation = makeInvitation(
        acme.id,
        ana.id,
        'sub-bruno@example.com',
      );
      await insert(invitation);
      const stale = (await invitations.findById(invitation.id))!;
      invitation.revoke(at(DAY));
      await invitations.respond(invitation);

      stale.accept(at(DAY));
      await expect(
        invitations.accept(
          stale,
          Membership.create({
            organizationId: acme.id,
            userId: bruno.id,
            role: stale.role,
          }),
        ),
      ).rejects.toBeInstanceOf(InvitationNotFoundError);

      expect(
        await prisma.membership.count({ where: { userId: bruno.id } }),
      ).toBe(0);
    });

    it('concorrência: dois aceites simultâneos, UM sucesso e UM membership', async () => {
      // O e-mail não é único: dois perfis com o mesmo e-mail disputam o
      // mesmo convite. Sem a trava, os dois entrariam na organização.
      const bruno = await createUser('sub-bruno', 'bruno@example.com');
      const brunoOutro = await createUser('sub-bruno-2', 'bruno@example.com');
      const invitation = makeInvitation(acme.id, ana.id, 'bruno@example.com');
      await insert(invitation);

      const attempts = await Promise.all(
        [bruno, brunoOutro].map(async (user) => {
          const copy = (await invitations.findById(invitation.id))!;
          copy.accept(at(DAY));
          return {
            invitation: copy,
            membership: Membership.create(
              { organizationId: acme.id, userId: user.id, role: copy.role },
              at(DAY),
            ),
          };
        }),
      );
      await warmPool();

      const results = await Promise.allSettled(
        attempts.map((a) => invitations.accept(a.invitation, a.membership)),
      );

      const rejected = results.filter((r) => r.status === 'rejected');
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(InvitationNotFoundError);
      expect(
        await prisma.membership.count({
          where: { organizationId: acme.id, userId: { not: ana.id } },
        }),
      ).toBe(1);
    });
  });
});
