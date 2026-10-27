import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { PrismaTransactionManager } from '@/shared/infrastructure/database/prisma-transaction-manager';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { PrismaUserRepository } from '@/modules/identity/infrastructure/persistence/prisma-user.repository';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { PrismaOrganizationRepository } from '@/modules/organizations/infrastructure/persistence/prisma-organization.repository';

let prisma: PrismaService;
let clients: PrismaClientProvider;
let transactions: PrismaTransactionManager;
let users: PrismaUserRepository;
let organizations: PrismaOrganizationRepository;

function makeUser(cognitoSub: string) {
  return User.create({
    cognitoSub,
    name: 'Usuário',
    email: `${cognitoSub}@example.com`,
  });
}

async function countRows() {
  const [usersCount, organizationsCount, membershipsCount] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.membership.count(),
  ]);
  return {
    users: usersCount,
    organizations: organizationsCount,
    memberships: membershipsCount,
  };
}

describe('PrismaTransactionManager (integração)', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    clients = new PrismaClientProvider(prisma);
    transactions = new PrismaTransactionManager(prisma, clients);
    users = new PrismaUserRepository(clients);
    organizations = new PrismaOrganizationRepository(clients, transactions);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "memberships", "organizations", "users" CASCADE`;
  });

  it('erro no fim desfaz as escritas de repositórios diferentes', async () => {
    const ana = makeUser('sub-ana');
    const acme = Organization.create({ name: 'Acme', slug: 'acme' });

    await expect(
      transactions.run(async () => {
        await users.create(ana);
        // createWithOwner abre a própria transação: aqui ela é reaproveitada.
        await organizations.createWithOwner(
          acme,
          Membership.createOwner(acme.id, ana.id),
        );
        throw new Error('falha depois das escritas');
      }),
    ).rejects.toThrow('falha depois das escritas');

    expect(await countRows()).toEqual({
      users: 0,
      organizations: 0,
      memberships: 0,
    });
  });

  it('sem erro, grava as escritas de repositórios diferentes juntas', async () => {
    const ana = makeUser('sub-ana');
    const acme = Organization.create({ name: 'Acme', slug: 'acme' });

    await transactions.run(async () => {
      await users.create(ana);
      await organizations.createWithOwner(
        acme,
        Membership.createOwner(acme.id, ana.id),
      );
    });

    expect(await countRows()).toEqual({
      users: 1,
      organizations: 1,
      memberships: 1,
    });
  });

  it('run aninhado usa a mesma transação: a escrita interna aparece para o externo e some se ele falhar', async () => {
    const ana = makeUser('sub-ana');
    let sameClient = false;
    let seenByOuter: User | null = null;
    let committedBeforeOuterEnds = -1;

    await expect(
      transactions.run(async () => {
        const outer = clients.current();
        await transactions.run(async () => {
          sameClient = clients.current() === outer;
          await users.create(ana);
        });

        seenByOuter = await users.findByCognitoSub('sub-ana');
        // O cliente padrão usa outra conexão: só enxerga o que já teve commit.
        committedBeforeOuterEnds = await prisma.user.count();
        throw new Error('falha no run externo');
      }),
    ).rejects.toThrow('falha no run externo');

    expect(sameClient).toBe(true);
    expect(seenByOuter).not.toBeNull();
    expect(committedBeforeOuterEnds).toBe(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it('fora de run, os repositórios usam o cliente padrão e gravam na hora', async () => {
    expect(clients.current()).toBe(prisma);

    await users.create(makeUser('sub-ana'));
    expect(await prisma.user.count()).toBe(1);

    // Depois que um run termina, o contexto volta ao cliente padrão.
    await transactions.run(async () => {
      await users.create(makeUser('sub-bruno'));
    });
    expect(clients.current()).toBe(prisma);
    expect(clients.isInTransaction()).toBe(false);
    expect(await prisma.user.count()).toBe(2);
  });
});
