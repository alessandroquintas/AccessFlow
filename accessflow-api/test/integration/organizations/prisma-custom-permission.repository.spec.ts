import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { PrismaTransactionManager } from '@/shared/infrastructure/database/prisma-transaction-manager';
import { CustomPermission } from '@/modules/organizations/domain/entities/custom-permission.entity';
import { PermissionKeyTakenError } from '@/modules/organizations/domain/errors/permission-key-taken.error';
import { PrismaCustomPermissionRepository } from '@/modules/organizations/infrastructure/persistence/prisma-custom-permission.repository';
import { PrismaCustomPermissionMapper } from '@/modules/organizations/infrastructure/persistence/mappers/prisma-custom-permission.mapper';
import {
  SeededOrganization,
  seedOrganization,
  seedRole,
} from '@test/factory/organizations/seed-organization';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const LATER = new Date('2026-03-02T12:00:00.000Z');

let prisma: PrismaService;
let permissions: PrismaCustomPermissionRepository;

function permission(organizationId: string, key: string, description = key) {
  return CustomPermission.create({ organizationId, key, description }, NOW);
}

async function keysOf(roleId: string) {
  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    orderBy: { permissionKey: 'asc' },
  });
  return rows.map((row) => row.permissionKey);
}

describe('PrismaCustomPermissionRepository (integração)', () => {
  let acme: SeededOrganization;
  let beta: SeededOrganization;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const clients = new PrismaClientProvider(prisma);
    permissions = new PrismaCustomPermissionRepository(
      clients,
      new PrismaTransactionManager(prisma, clients),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "memberships", "organizations", "users" CASCADE`;
    acme = await seedOrganization(prisma, { slug: 'acme' });
    beta = await seedOrganization(prisma, { slug: 'beta' });
  });

  it('create grava; findByKey e listByOrganization leem só da organização, por chave', async () => {
    const approve = permission(acme.id, 'invoices:approve', 'Aprovar faturas');
    for (const created of [
      approve,
      permission(acme.id, 'invoices-items:read'),
      permission(acme.id, 'contracts:sign'),
      permission(beta.id, 'invoices:approve'),
    ]) {
      await permissions.create(created);
    }

    expect(await permissions.findByKey(acme.id, 'invoices:approve')).toEqual(
      approve,
    );
    expect(await permissions.findByKey(acme.id, 'invoices:refund')).toBeNull();
    // Ordem de código: o hífen vem antes das letras, como no catálogo efetivo.
    expect(
      (await permissions.listByOrganization(acme.id)).map((p) => p.key),
    ).toEqual(['contracts:sign', 'invoices-items:read', 'invoices:approve']);
    expect(
      await prisma.customPermission.findUniqueOrThrow({
        where: { id: approve.id },
      }),
    ).toMatchObject({
      organizationId: acme.id,
      key: 'invoices:approve',
      description: 'Aprovar faturas',
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('chave repetida na mesma organização: PERMISSION_KEY_TAKEN pela unique do banco', async () => {
    await permissions.create(permission(acme.id, 'invoices:approve'));

    await expect(
      permissions.create(permission(acme.id, 'invoices:approve')),
    ).rejects.toBeInstanceOf(PermissionKeyTakenError);
    expect(await prisma.customPermission.count()).toBe(1);
  });

  it('a unique é por organização: a mesma chave em outra passa', async () => {
    await permissions.create(permission(acme.id, 'invoices:approve'));
    await permissions.create(permission(beta.id, 'invoices:approve'));

    expect(await prisma.customPermission.count()).toBe(2);
  });

  it('FK: organização inexistente é recusada', async () => {
    const error = await prisma.customPermission
      .create({
        data: PrismaCustomPermissionMapper.toPersistence(
          permission(crypto.randomUUID(), 'invoices:approve'),
        ),
      })
      .catch((e: unknown) => e);

    expect(
      error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003',
    ).toBe(true);
  });

  it('save grava só a descrição e o updatedAt', async () => {
    const approve = permission(acme.id, 'invoices:approve', 'Aprovar');
    await permissions.create(approve);

    approve.changeDescription('Aprovar faturas acima do limite', LATER);
    await permissions.save(approve);

    expect(
      await prisma.customPermission.findUniqueOrThrow({
        where: { id: approve.id },
      }),
    ).toMatchObject({
      key: 'invoices:approve',
      description: 'Aprovar faturas acima do limite',
      createdAt: NOW,
      updatedAt: LATER,
    });
  });

  describe('isInUse', () => {
    beforeEach(async () => {
      await permissions.create(permission(acme.id, 'invoices:approve'));
    });

    it('sem papel com a chave: false', async () => {
      expect(await permissions.isInUse(acme.id, 'invoices:approve')).toBe(
        false,
      );
    });

    it('papel não apagado da organização com a chave: true', async () => {
      await seedRole(prisma, {
        organizationId: acme.id,
        name: 'Financeiro',
        permissions: ['invoices:approve'],
      });

      expect(await permissions.isInUse(acme.id, 'invoices:approve')).toBe(true);
    });

    it('papel apagado ou de outra organização não conta', async () => {
      await seedRole(prisma, {
        organizationId: acme.id,
        name: 'Antigo',
        permissions: ['invoices:approve'],
        deletedAt: NOW,
      });
      await seedRole(prisma, {
        organizationId: beta.id,
        name: 'Financeiro',
        permissions: ['invoices:approve'],
      });

      expect(await permissions.isInUse(acme.id, 'invoices:approve')).toBe(
        false,
      );
    });
  });

  it('delete exclui a permissão e as linhas dela em papéis apagados, sem tocar no resto', async () => {
    const approve = permission(acme.id, 'invoices:approve');
    await permissions.create(approve);
    await permissions.create(permission(beta.id, 'invoices:approve'));
    const deletedRole = await seedRole(prisma, {
      organizationId: acme.id,
      name: 'Antigo',
      permissions: ['invoices:approve', 'members:read'],
      deletedAt: NOW,
    });
    const betaRole = await seedRole(prisma, {
      organizationId: beta.id,
      name: 'Financeiro',
      permissions: ['invoices:approve'],
    });

    await permissions.delete(approve);

    expect(await permissions.findByKey(acme.id, 'invoices:approve')).toBeNull();
    expect(await keysOf(deletedRole)).toEqual(['members:read']);
    expect(await keysOf(betaRole)).toEqual(['invoices:approve']);
    expect(
      await permissions.findByKey(beta.id, 'invoices:approve'),
    ).not.toBeNull();
  });

  it('delete não tira a chave de papel ativo (se quem chamou pulou o isInUse)', async () => {
    const approve = permission(acme.id, 'invoices:approve');
    await permissions.create(approve);
    const active = await seedRole(prisma, {
      organizationId: acme.id,
      name: 'Financeiro',
      permissions: ['invoices:approve'],
    });

    await permissions.delete(approve);

    expect(await keysOf(active)).toEqual(['invoices:approve']);
  });
});
