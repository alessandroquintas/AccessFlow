import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import {
  Membership,
  MembershipRole,
} from '@/modules/organizations/domain/entities/membership.entity';
import { SlugAlreadyTakenError } from '@/modules/organizations/domain/errors/slug-already-taken.error';
import { PrismaOrganizationRepository } from '@/modules/organizations/infrastructure/persistenece/prisma-organization.repository';
import { PrismaMembershipRepository } from '@/modules/organizations/infrastructure/persistenece/prisma-membership.repository';

let prisma: PrismaService;
let organizations: PrismaOrganizationRepository;
let memberships: PrismaMembershipRepository;

async function createUser(cognitoSub: string) {
  return prisma.user.create({
    data: { cognitoSub, name: 'Usuário', email: `${cognitoSub}@example.com` },
  });
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
    await prisma.$executeRaw`TRUNCATE TABLE "memberships", "organizations", "users" CASCADE`;
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
});
