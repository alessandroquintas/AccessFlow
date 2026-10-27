import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TransactionRolledBackError } from '@/shared/application/errors/transaction-rolled-back.error';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { PrismaTransactionManager } from '@/shared/infrastructure/database/prisma-transaction-manager';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { PrismaUserRepository } from '@/modules/identity/infrastructure/persistence/prisma-user.repository';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { Role } from '@/modules/organizations/domain/entities/role.entity';
import { PrismaOrganizationRepository } from '@/modules/organizations/infrastructure/persistence/prisma-organization.repository';
import { PrismaRoleRepository } from '@/modules/organizations/infrastructure/persistence/prisma-role.repository';
import { PrismaMembershipRepository } from '@/modules/organizations/infrastructure/persistence/prisma-membership.repository';

let prisma: PrismaService;
let clients: PrismaClientProvider;
let transactions: PrismaTransactionManager;
let users: PrismaUserRepository;
let organizations: PrismaOrganizationRepository;
let roles: PrismaRoleRepository;
let memberships: PrismaMembershipRepository;

function makeUser(cognitoSub: string) {
  return User.create({
    cognitoSub,
    name: 'Usuário',
    email: `${cognitoSub}@example.com`,
  });
}

/** Organização, papéis padrão e o OWNER: escritas em três repositórios. */
async function createOrganizationWithOwner(
  organization: Organization,
  ownerId: string,
) {
  const defaults = Role.createDefaults(organization.id, new Date());
  await organizations.create(organization);
  // createDefaults abre a própria transação: aqui ela é reaproveitada.
  await roles.createDefaults(defaults);
  await memberships.create(
    Membership.create({
      organizationId: organization.id,
      userId: ownerId,
      roleId: defaults.owner.id,
    }),
  );
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
    organizations = new PrismaOrganizationRepository(clients);
    roles = new PrismaRoleRepository(clients, transactions);
    memberships = new PrismaMembershipRepository(clients, transactions);
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
        await createOrganizationWithOwner(acme, ana.id);
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
      await createOrganizationWithOwner(acme, ana.id);
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
    expect(clients.active()).toBeUndefined();
    expect(await prisma.user.count()).toBe(2);
  });

  describe('rollback-only', () => {
    it('externo que captura o erro de um run interno e segue em frente termina com erro e nada gravado', async () => {
      const innerError = new Error('falha no run interno');

      const outcome = transactions.run(async () => {
        await users.create(makeUser('sub-ana'));
        try {
          await transactions.run(async () => {
            await users.create(makeUser('sub-bruno'));
            throw innerError;
          });
        } catch {
          // Engole o erro e segue: sem rollback-only, as duas escritas
          // iriam para commit.
        }
        await users.create(makeUser('sub-carla'));
        return 'terminou sem lançar';
      });

      await expect(outcome).rejects.toBeInstanceOf(TransactionRolledBackError);
      await expect(outcome).rejects.toMatchObject({ cause: innerError });
      expect(await prisma.user.count()).toBe(0);
    });

    it('erro de run interno que não é capturado chega ao externo como está', async () => {
      const innerError = new Error('falha no run interno');

      await expect(
        transactions.run(async () => {
          await users.create(makeUser('sub-ana'));
          await transactions.run(async () => {
            throw innerError;
          });
        }),
      ).rejects.toBe(innerError);
      expect(await prisma.user.count()).toBe(0);
    });

    it('a marca vale só para a transação em que o run interno falhou', async () => {
      await expect(
        transactions.run(async () => {
          await transactions
            .run(async () => {
              throw new Error('falha no run interno');
            })
            .catch(() => undefined);
        }),
      ).rejects.toBeInstanceOf(TransactionRolledBackError);

      await transactions.run(async () => {
        await transactions.run(async () => {
          await users.create(makeUser('sub-ana'));
        });
      });
      expect(await prisma.user.count()).toBe(1);
    });
  });
});
