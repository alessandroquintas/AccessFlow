import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { PrismaTransactionManager } from '@/shared/infrastructure/database/prisma-transaction-manager';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { RoleSystemKey } from '@/modules/organizations/domain/entities/role.entity';
import { SlugAlreadyTakenError } from '@/modules/organizations/domain/errors/slug-already-taken.error';
import { LastOwnerError } from '@/modules/organizations/domain/errors/last-owner.error';
import { CreateOrganizationUseCase } from '@/modules/organizations/application/use-cases/create-organization.use-case';
import { PrismaMembershipMapper } from '@/modules/organizations/infrastructure/persistence/mappers/prisma-membership.mapper';
import { PrismaOrganizationRepository } from '@/modules/organizations/infrastructure/persistence/prisma-organization.repository';
import { PrismaMembershipRepository } from '@/modules/organizations/infrastructure/persistence/prisma-membership.repository';
import { PrismaRoleRepository } from '@/modules/organizations/infrastructure/persistence/prisma-role.repository';
import { FakeUserDirectory } from '@test/fakes/organizations/fake-user-directory';
import { FixedClock } from '@test/fakes/shared/fixed-clock';
import { seedOrganization } from '@test/factory/organizations/seed-organization';

let prisma: PrismaService;
let organizations: PrismaOrganizationRepository;
let memberships: PrismaMembershipRepository;
let roles: PrismaRoleRepository;
let users: FakeUserDirectory;
let createOrganization: CreateOrganizationUseCase;

async function createUser(cognitoSub: string) {
  const user = await prisma.user.create({
    data: { cognitoSub, name: 'Usuário', email: `${cognitoSub}@example.com` },
  });
  users.register(cognitoSub, user.id);
  return user;
}

async function addMembership(
  organizationId: string,
  userId: string,
  roleId: string,
  now?: Date,
) {
  const membership = Membership.create({ organizationId, userId, roleId }, now);
  await prisma.membership.create({
    data: PrismaMembershipMapper.toPersistence(membership),
  });
  return membership;
}

async function createOrganizationWithOwner(slug: string, ownerId: string) {
  return seedOrganization(prisma, {
    slug,
    name: 'Acme',
    members: [
      {
        userId: ownerId,
        role: RoleSystemKey.OWNER,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ],
  });
}

describe('Repositórios de organizations (integração)', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const clients = new PrismaClientProvider(prisma);
    const transactions = new PrismaTransactionManager(prisma, clients);
    organizations = new PrismaOrganizationRepository(clients);
    memberships = new PrismaMembershipRepository(clients, transactions);
    roles = new PrismaRoleRepository(clients, transactions);
    users = new FakeUserDirectory();
    createOrganization = new CreateOrganizationUseCase(
      organizations,
      roles,
      memberships,
      users,
      transactions,
      new FixedClock(),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "memberships", "organizations", "users" CASCADE`;
  });

  it('cria a organização e o OWNER juntos', async () => {
    const user = await createUser('sub-ana');

    const { organization } = await createOrganization.execute({
      cognitoSub: 'sub-ana',
      name: 'Acme',
      slug: 'acme',
    });

    const found = await organizations.findById(organization.id);
    expect(found?.slug).toBe('acme');

    const membership = await memberships.findByOrganizationAndUser(
      organization.id,
      user.id,
    );
    expect(
      (await roles.findById(organization.id, membership!.roleId))?.isOwner(),
    ).toBe(true);
  });

  it('recusa slug duplicado e não deixa nada pela metade', async () => {
    await createUser('sub-ana');
    await createUser('sub-bruno');

    await createOrganization.execute({
      cognitoSub: 'sub-ana',
      name: 'Acme',
      slug: 'acme',
    });

    await expect(
      createOrganization.execute({
        cognitoSub: 'sub-bruno',
        name: 'Outra Acme',
        slug: 'acme',
      }),
    ).rejects.toBeInstanceOf(SlugAlreadyTakenError);

    expect(await prisma.organization.count()).toBe(1);
    expect(await prisma.membership.count()).toBe(1);
  });

  it('desfaz a organização se o membership falhar (atomicidade)', async () => {
    // Perfil que o diretório conhece, mas sem linha em users: a FK do
    // membership falha depois que a organização e os papéis foram gravados.
    users.register('sub-sem-usuario', crypto.randomUUID());

    await expect(
      createOrganization.execute({
        cognitoSub: 'sub-sem-usuario',
        name: 'Acme',
        slug: 'acme',
      }),
    ).rejects.toThrow();

    expect(await prisma.organization.count()).toBe(0);
  });

  it('lista só os memberships ativos do usuário', async () => {
    const user = await createUser('sub-ana');

    const acme = await seedOrganization(prisma, {
      slug: 'acme',
      owner: user.id,
    });

    const beta = await seedOrganization(prisma, {
      slug: 'beta',
      owner: user.id,
    });
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
    const acme = await seedOrganization(prisma, {
      slug: 'acme',
      owner: ana.id,
    });

    expect(
      await memberships.findByOrganizationAndUser(acme.id, bruno.id),
    ).toBeNull();
  });

  it('memberships.role_id guarda o papel corretamente', async () => {
    const user = await createUser('sub-ana');
    const acme = await seedOrganization(prisma, {
      slug: 'acme',
      owner: user.id,
    });

    const membership = await memberships.findByOrganizationAndUser(
      acme.id,
      user.id,
    );

    expect(membership?.roleId).toBe(acme.roleIds.OWNER);
  });

  it('save persiste o novo nome', async () => {
    const organization = Organization.create({ name: 'Acme', slug: 'acme' });
    await organizations.create(organization);

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
          acme.roleIds.MEMBER,
          sameTime,
        ),
        await addMembership(
          acme.id,
          (await createUser('sub-c')).id,
          acme.roleIds.MEMBER,
          sameTime,
        ),
      ].sort((a, b) => (a.id < b.id ? -1 : 1));
      const later = await addMembership(
        acme.id,
        (await createUser('sub-d')).id,
        acme.roleIds.MEMBER,
        new Date('2026-01-03T00:00:00Z'),
      );
      const removed = await addMembership(
        acme.id,
        (await createUser('sub-e')).id,
        acme.roleIds.MEMBER,
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
        acme.roleIds.MEMBER,
      );

      await memberships.remove(member, new Date());

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

      await expect(
        memberships.remove(owner!, new Date()),
      ).rejects.toBeInstanceOf(LastOwnerError);

      const record = await prisma.membership.findUnique({
        where: { id: owner!.id },
      });
      expect(record?.status).toBe('ACTIVE');
    });

    it('concorrência: dois OWNERs removidos ao mesmo tempo, só um sai', async () => {
      const ana = await createUser('sub-ana');
      const bruno = await createUser('sub-bruno');
      const acme = await createOrganizationWithOwner('acme', ana.id);
      await addMembership(acme.id, bruno.id, acme.roleIds.OWNER);

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
        memberships.remove(anaOwner!, new Date()),
        memberships.remove(brunoOwner!, new Date()),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(LastOwnerError);

      expect(
        await prisma.membership.count({
          where: {
            organizationId: acme.id,
            role: { systemKey: 'OWNER' },
            status: 'ACTIVE',
          },
        }),
      ).toBe(1);
    });
  });
});
