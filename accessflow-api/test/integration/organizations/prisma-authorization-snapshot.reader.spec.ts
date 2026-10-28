import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { RoleSystemKey } from '@/modules/organizations/domain/entities/role.entity';
import { PrismaAuthorizationSnapshotReader } from '@/modules/organizations/infrastructure/persistence/prisma-authorization-snapshot.reader';
import {
  SeededOrganization,
  seedMembership,
  seedOrganization,
  seedRole,
} from '@test/factory/organizations/seed-organization';

const APPROVE = 'invoices:approve';
const SIGN = 'contracts:sign';

let prisma: PrismaService;
let reader: PrismaAuthorizationSnapshotReader;

async function createUser(cognitoSub: string) {
  return prisma.user.create({
    data: { cognitoSub, name: 'Usuário', email: `${cognitoSub}@example.com` },
  });
}

describe('PrismaAuthorizationSnapshotReader (integração)', () => {
  let acme: SeededOrganization;
  let beta: SeededOrganization;
  let ana: { id: string };
  let bruno: { id: string };
  let financeId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    reader = new PrismaAuthorizationSnapshotReader(
      new PrismaClientProvider(prisma),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "memberships", "organizations", "users" CASCADE`;
    ana = await createUser('sub-ana');
    bruno = await createUser('sub-bruno');
    acme = await seedOrganization(prisma, { slug: 'acme', owner: ana.id });
    beta = await seedOrganization(prisma, { slug: 'beta', owner: ana.id });
    await prisma.customPermission.createMany({
      data: [
        { organizationId: acme.id, key: APPROVE, description: 'Aprovar' },
        { organizationId: acme.id, key: SIGN, description: 'Assinar' },
        { organizationId: beta.id, key: 'payments:refund', description: 'X' },
      ],
    });
    financeId = await seedRole(prisma, {
      organizationId: acme.id,
      name: 'Financeiro',
      permissions: ['members:read', APPROVE],
    });
  });

  it('membro ativo: o papel com todas as permissões; das chaves pedidas, as personalizadas que existem na organização', async () => {
    await seedMembership(prisma, {
      organizationId: acme.id,
      userId: bruno.id,
      roleId: financeId,
    });

    const snapshot = await reader.load(acme.id, bruno.id, [
      SIGN,
      'invoices:refund',
      'payments:refund',
      'members:read',
    ]);

    const role = snapshot.membership?.role;
    expect(role).toMatchObject({
      id: financeId,
      organizationId: acme.id,
      name: 'Financeiro',
      systemKey: null,
      deletedAt: null,
    });
    expect(role?.permissions).toEqual(['members:read', APPROVE]);
    expect(role?.createdAt).toBeInstanceOf(Date);
    expect(snapshot.customKeys).toEqual([SIGN]);
  });

  it('OWNER: papel de sistema sem permissões gravadas', async () => {
    const snapshot = await reader.load(acme.id, ana.id, [APPROVE]);

    expect(snapshot.membership?.role).toMatchObject({
      id: acme.roleIds.OWNER,
      systemKey: RoleSystemKey.OWNER,
      permissions: [],
    });
    expect(snapshot.customKeys).toEqual([APPROVE]);
  });

  it('não membro ou membro removido: membership null', async () => {
    expect((await reader.load(acme.id, bruno.id, [APPROVE])).membership).toBe(
      null,
    );

    await seedMembership(prisma, {
      organizationId: acme.id,
      userId: bruno.id,
      roleId: financeId,
      status: 'REMOVED',
    });
    expect((await reader.load(acme.id, bruno.id, [APPROVE])).membership).toBe(
      null,
    );
  });

  it('papel apagado num membership ativo vem com deletedAt, para o caso de uso falhar fechado', async () => {
    await seedMembership(prisma, {
      organizationId: acme.id,
      userId: bruno.id,
      roleId: financeId,
    });
    await prisma.role.update({
      where: { id: financeId },
      data: { deletedAt: new Date('2026-03-01T12:00:00.000Z') },
    });

    const snapshot = await reader.load(acme.id, bruno.id, [APPROVE]);

    expect(snapshot.membership?.role?.isDeleted()).toBe(true);
  });

  it('membership de outra organização não conta', async () => {
    await seedMembership(prisma, { organizationId: beta.id, userId: bruno.id });

    const snapshot = await reader.load(acme.id, bruno.id, ['payments:refund']);

    expect(snapshot).toEqual({ membership: null, customKeys: [] });
  });
});
