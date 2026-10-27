import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import {
  Membership,
  MembershipRole,
} from '@/modules/organizations/domain/entities/membership.entity';
import { SlugAlreadyTakenError } from '@/modules/organizations/domain/errors/slug-already-taken.error';
import { LastOwnerError } from '@/modules/organizations/domain/errors/last-owner.error';
import { PrismaMembershipMapper } from '@/modules/organizations/infrastructure/persistence/mappers/prisma-membership.mapper';
import { PrismaOrganizationRepository } from '@/modules/organizations/infrastructure/persistence/prisma-organization.repository';
import { PrismaMembershipRepository } from '@/modules/organizations/infrastructure/persistence/prisma-membership.repository';

let prisma: PrismaService;
let organizations: PrismaOrganizationRepository;
let memberships: PrismaMembershipRepository;

async function createUser(cognitoSub: string) {
  return prisma.user.create({
    data: { cognitoSub, name: 'Usuário', email: `${cognitoSub}@example.com` },
  });
}

async function addMembership(
  organizationId: string,
  userId: string,
  role: MembershipRole,
  now?: Date,
) {
  const membership = Membership.create({ organizationId, userId, role }, now);
  await prisma.membership.create({
    data: PrismaMembershipMapper.toPersistence(membership),
  });
  return membership;
}

async function createOrganizationWithOwner(slug: string, ownerId: string) {
  const organization = Organization.create({ name: 'Acme', slug });
  await organizations.createWithOwner(
    organization,
    Membership.createOwner(
      organization.id,
      ownerId,
      new Date('2026-01-01T00:00:00Z'),
    ),
  );
  return organization;
}

describe('Repositórios de organizations (integração)', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    organizations = new PrismaOrganizationRepository(prisma);
    memberships = new PrismaMembershipRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "memberships", "organizations", "users" CASCADE`;
  });

  it('cria a organização e o OWNER juntos', async () => {
    const user = await createUser('sub-ana');
    const organization = Organization.create({ name: 'Acme', slug: 'acme' });
    const owner = Membership.createOwner(organization.id, user.id);

    await organizations.createWithOwner(organization, owner);

    const found = await organizations.findById(organization.id);
    expect(found?.slug).toBe('acme');

    const membership = await memberships.findByOrganizationAndUser(
      organization.id,
      user.id,
    );
    expect(membership?.isOwner()).toBe(true);
  });

  it('recusa slug duplicado e não deixa nada pela metade', async () => {
    const ana = await createUser('sub-ana');
    const bruno = await createUser('sub-bruno');

    const first = Organization.create({ name: 'Acme', slug: 'acme' });
    await organizations.createWithOwner(
      first,
      Membership.createOwner(first.id, ana.id),
    );

    const second = Organization.create({ name: 'Outra Acme', slug: 'acme' });
    await expect(
      organizations.createWithOwner(
        second,
        Membership.createOwner(second.id, bruno.id),
      ),
    ).rejects.toBeInstanceOf(SlugAlreadyTakenError);

    expect(await prisma.organization.count()).toBe(1);
    expect(await prisma.membership.count()).toBe(1);
  });

  it('desfaz a organização se o membership falhar (atomicidade)', async () => {
    const organization = Organization.create({ name: 'Acme', slug: 'acme' });
    const ownerSemUsuario = Membership.createOwner(
      organization.id,
      crypto.randomUUID(),
    );

    await expect(
      organizations.createWithOwner(organization, ownerSemUsuario),
    ).rejects.toThrow();

    expect(await prisma.organization.count()).toBe(0);
  });

  it('lista só os memberships ativos do usuário', async () => {
    const user = await createUser('sub-ana');

    const acme = Organization.create({ name: 'Acme', slug: 'acme' });
    await organizations.createWithOwner(
      acme,
      Membership.createOwner(acme.id, user.id),
    );

    const beta = Organization.create({ name: 'Beta', slug: 'beta' });
    await organizations.createWithOwner(
      beta,
      Membership.createOwner(beta.id, user.id),
    );
    await prisma.membership.updateMany({
      where: { organizationId: beta.id },
      data: { status: 'REMOVED' },
    });

    const active = await memberships.listActiveByUser(user.id);

    expect(active.map((m) => m.organizationId)).toEqual([acme.id]);
  });

  it('retorna null quando o usuário não pertence à organização', async () => {
    const ana = await createUser('sub-ana');
    const bruno = await createUser('sub-bruno');
    const acme = Organization.create({ name: 'Acme', slug: 'acme' });
    await organizations.createWithOwner(
      acme,
      Membership.createOwner(acme.id, ana.id),
    );

    expect(
      await memberships.findByOrganizationAndUser(acme.id, bruno.id),
    ).toBeNull();
  });

  it('memberships.role guarda o papel corretamente', async () => {
    const user = await createUser('sub-ana');
    const acme = Organization.create({ name: 'Acme', slug: 'acme' });
    await organizations.createWithOwner(
      acme,
      Membership.createOwner(acme.id, user.id),
    );

    const membership = await memberships.findByOrganizationAndUser(
      acme.id,
      user.id,
    );

    expect(membership?.role).toBe(MembershipRole.OWNER);
  });

  it('save persiste o novo nome', async () => {
    const user = await createUser('sub-ana');
    const organization = Organization.create({ name: 'Acme', slug: 'acme' });
    await organizations.createWithOwner(
      organization,
      Membership.createOwner(organization.id, user.id),
    );

    organization.rename('Acme Global');
    await organizations.save(organization);

    expect((await organizations.findById(organization.id))?.name).toBe(
      'Acme Global',
    );
  });

  describe('listActiveByOrganization', () => {
    it('pagina com cursor, desempata pelo id e ignora removidos', async () => {
      const ana = await createUser('sub-ana');
      const acme = await createOrganizationWithOwner('acme', ana.id);

      // Dois membros com o mesmo createdAt: o id decide a ordem.
      const sameTime = new Date('2026-01-02T00:00:00Z');
      const tied = [
        await addMembership(
          acme.id,
          (await createUser('sub-b')).id,
          MembershipRole.MEMBER,
          sameTime,
        ),
        await addMembership(
          acme.id,
          (await createUser('sub-c')).id,
          MembershipRole.MEMBER,
          sameTime,
        ),
      ].sort((a, b) => (a.id < b.id ? -1 : 1));
      const later = await addMembership(
        acme.id,
        (await createUser('sub-d')).id,
        MembershipRole.MEMBER,
        new Date('2026-01-03T00:00:00Z'),
      );
      const removed = await addMembership(
        acme.id,
        (await createUser('sub-e')).id,
        MembershipRole.MEMBER,
        new Date('2026-01-04T00:00:00Z'),
      );
      await prisma.membership.update({
        where: { id: removed.id },
        data: { status: 'REMOVED' },
      });

      const first = await memberships.listActiveByOrganization(acme.id, {
        first: 2,
      });
      const last = first.items.at(-1)!;
      const second = await memberships.listActiveByOrganization(acme.id, {
        first: 2,
        after: { createdAt: last.createdAt, id: last.id },
      });

      expect(first.hasNextPage).toBe(true);
      expect(second.hasNextPage).toBe(false);
      expect([...first.items, ...second.items].map((m) => m.userId)).toEqual([
        ana.id,
        tied[0].userId,
        tied[1].userId,
        later.userId,
      ]);
    });
  });

  describe('remove', () => {
    it('marca como REMOVED sem apagar a linha', async () => {
      const ana = await createUser('sub-ana');
      const bruno = await createUser('sub-bruno');
      const acme = await createOrganizationWithOwner('acme', ana.id);
      const member = await addMembership(
        acme.id,
        bruno.id,
        MembershipRole.MEMBER,
      );

      await memberships.remove(member);

      const record = await prisma.membership.findUnique({
        where: { id: member.id },
      });
      expect(record?.status).toBe('REMOVED');
      expect(await prisma.membership.count()).toBe(2);
    });

    it('recusa remover o último OWNER e mantém o membership ativo', async () => {
      const ana = await createUser('sub-ana');
      const acme = await createOrganizationWithOwner('acme', ana.id);
      const owner = await memberships.findByOrganizationAndUser(
        acme.id,
        ana.id,
      );

      await expect(memberships.remove(owner!)).rejects.toBeInstanceOf(
        LastOwnerError,
      );

      const record = await prisma.membership.findUnique({
        where: { id: owner!.id },
      });
      expect(record?.status).toBe('ACTIVE');
    });

    it('concorrência: dois OWNERs removidos ao mesmo tempo, só um sai', async () => {
      const ana = await createUser('sub-ana');
      const bruno = await createUser('sub-bruno');
      const acme = await createOrganizationWithOwner('acme', ana.id);
      await addMembership(acme.id, bruno.id, MembershipRole.OWNER);

      const [anaOwner, brunoOwner] = await Promise.all([
        memberships.findByOrganizationAndUser(acme.id, ana.id),
        memberships.findByOrganizationAndUser(acme.id, bruno.id),
      ]);

      // Abre conexões no pool antes da corrida. Sem isso, a segunda
      // transação espera uma conexão nova e só começa depois que a primeira
      // terminou, e o teste passaria mesmo sem a trava.
      await Promise.all(
        Array.from({ length: 4 }, () => prisma.$queryRaw`SELECT 1`),
      );

      const results = await Promise.allSettled([
        memberships.remove(anaOwner!),
        memberships.remove(brunoOwner!),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(LastOwnerError);

      expect(
        await prisma.membership.count({
          where: { organizationId: acme.id, role: 'OWNER', status: 'ACTIVE' },
        }),
      ).toBe(1);
    });
  });
});
