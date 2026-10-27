import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaIntegrationClientRepository } from '@/modules/organizations/infrastructure/persistence/prisma-integration-client.repository';
import {
  IntegrationClient,
  IntegrationClientStatus,
} from '@/modules/organizations/domain/entities/integration-client.entity';

let prisma: PrismaService;
let sut: PrismaIntegrationClientRepository;

async function createOrganization(slug: string) {
  return prisma.organization.create({ data: { name: slug, slug } });
}

describe('PrismaIntegrationClientRepository (integração)', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    sut = new PrismaIntegrationClientRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "integration_clients", "memberships", "organizations", "users" CASCADE`;
  });

  it('encontra o client pelo clientId do Cognito', async () => {
    const acme = await createOrganization('acme');
    const created = await prisma.integrationClient.create({
      data: {
        clientId: 'client-acme',
        organizationId: acme.id,
        name: 'ERP da Acme',
      },
    });

    const client = await sut.findByClientId('client-acme');

    expect(client).toBeInstanceOf(IntegrationClient);
    expect(client?.id).toBe(created.id);
    expect(client?.organizationId).toBe(acme.id);
    expect(client?.name).toBe('ERP da Acme');
    expect(client?.status).toBe(IntegrationClientStatus.ACTIVE);
    expect(client?.isActive()).toBe(true);
  });

  it('mapeia o status REVOKED', async () => {
    const acme = await createOrganization('acme');
    await prisma.integrationClient.create({
      data: {
        clientId: 'client-acme',
        organizationId: acme.id,
        name: 'ERP da Acme',
        status: 'REVOKED',
      },
    });

    const client = await sut.findByClientId('client-acme');

    expect(client?.status).toBe(IntegrationClientStatus.REVOKED);
    expect(client?.isActive()).toBe(false);
  });

  it('retorna null para clientId desconhecido', async () => {
    expect(await sut.findByClientId('client-desconhecido')).toBeNull();
  });

  it('não permite o mesmo clientId duas vezes', async () => {
    const acme = await createOrganization('acme');
    const beta = await createOrganization('beta');
    await prisma.integrationClient.create({
      data: { clientId: 'client-x', organizationId: acme.id, name: 'Primeiro' },
    });

    const duplicate = prisma.integrationClient.create({
      data: { clientId: 'client-x', organizationId: beta.id, name: 'Segundo' },
    });

    await expect(duplicate).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
    await expect(duplicate).rejects.toMatchObject({ code: 'P2002' });
    expect(await prisma.integrationClient.count()).toBe(1);
  });
});
