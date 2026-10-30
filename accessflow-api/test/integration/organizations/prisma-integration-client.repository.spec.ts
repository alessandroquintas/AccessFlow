import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import { PrismaIntegrationClientRepository } from '@/modules/organizations/infrastructure/persistence/prisma-integration-client.repository';
import {
  IntegrationClient,
  IntegrationClientStatus,
} from '@/modules/organizations/domain/entities/integration-client.entity';
import { MachineScope } from '@/shared/domain/machine-scope';

const SCOPES = [MachineScope.MEMBERS_READ];
const NOW = new Date('2026-03-01T12:00:00.000Z');
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

let prisma: PrismaService;
let sut: PrismaIntegrationClientRepository;

async function createOrganization(slug: string) {
  return prisma.organization.create({ data: { name: slug, slug } });
}

describe('PrismaIntegrationClientRepository (integração)', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    sut = new PrismaIntegrationClientRepository(
      new PrismaClientProvider(prisma),
    );
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
        scopes: SCOPES,
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
        scopes: SCOPES,
        status: 'REVOKED',
        revokedAt: NOW,
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
      data: {
        clientId: 'client-x',
        organizationId: acme.id,
        name: 'Primeiro',
        scopes: SCOPES,
      },
    });

    const duplicate = prisma.integrationClient.create({
      data: {
        clientId: 'client-x',
        organizationId: beta.id,
        name: 'Segundo',
        scopes: SCOPES,
      },
    });

    await expect(duplicate).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
    await expect(duplicate).rejects.toMatchObject({ code: 'P2002' });
    expect(await prisma.integrationClient.count()).toBe(1);
  });

  describe('ciclo de vida pelo painel', () => {
    let acmeId: string;
    let anaId: string;

    beforeEach(async () => {
      acmeId = (await createOrganization('acme')).id;
      anaId = (
        await prisma.user.create({
          data: { cognitoSub: 'ana', name: 'Ana', email: 'ana@example.com' },
        })
      ).id;
    });

    function newIntegration(name = 'ERP', minutes = 0) {
      return IntegrationClient.create(
        {
          organizationId: acmeId,
          name,
          scopes: [MachineScope.AUTHORIZE, MachineScope.MEMBERS_READ],
          createdByUserId: anaId,
        },
        at(minutes),
      );
    }

    it('grava em PROVISIONING sem clientId e devolve igual', async () => {
      const integration = newIntegration('  ERP   Financeiro ');

      await sut.create(integration);

      const found = await sut.findById(acmeId, integration.id);
      expect(found).toEqual(integration);
      expect(found).toMatchObject({
        clientId: null,
        name: 'ERP Financeiro',
        scopes: [MachineScope.MEMBERS_READ, MachineScope.AUTHORIZE],
        status: IntegrationClientStatus.PROVISIONING,
        createdByUserId: anaId,
      });
    });

    it('save grava activate e revoke; o findByClientId acha a ativa', async () => {
      const integration = newIntegration();
      await sut.create(integration);

      integration.activate('client-novo', at(1));
      await sut.save(integration);
      expect((await sut.findByClientId('client-novo'))?.isActive()).toBe(true);

      integration.revoke(anaId, at(2));
      await sut.save(integration);
      expect(await sut.findById(acmeId, integration.id)).toMatchObject({
        status: IntegrationClientStatus.REVOKED,
        clientId: 'client-novo',
        revokedAt: at(2),
        revokedByUserId: anaId,
        updatedAt: at(2),
      });
    });

    it('save grava a falha (FAILED, sem clientId)', async () => {
      const integration = newIntegration();
      await sut.create(integration);

      integration.fail(at(1));
      await sut.save(integration);

      expect(await sut.findById(acmeId, integration.id)).toMatchObject({
        status: IntegrationClientStatus.FAILED,
        clientId: null,
      });
    });

    it('findById: só da organização pedida; id fora do formato é null', async () => {
      const integration = newIntegration();
      await sut.create(integration);
      const beta = await createOrganization('beta');

      expect(await sut.findById(beta.id, integration.id)).toBeNull();
      expect(await sut.findById(acmeId, 'nao-e-uuid')).toBeNull();
    });

    it('lista todas da organização, da mais nova à mais antiga', async () => {
      const old = newIntegration('Antiga', 0);
      const recent = newIntegration('Recente', 10);
      for (const i of [old, recent]) await sut.create(i);
      const beta = await createOrganization('beta');
      await sut.create(
        IntegrationClient.create(
          {
            organizationId: beta.id,
            name: 'Da Beta',
            scopes: SCOPES,
            createdByUserId: anaId,
          },
          NOW,
        ),
      );

      const listed = await sut.listByOrganization(acmeId);

      expect(listed.map((i) => i.name)).toEqual(['Recente', 'Antiga']);
    });

    it('conta só as que ocupam vaga: PROVISIONING e ACTIVE', async () => {
      const [provisioning, active, revoked, failed] = [
        newIntegration('Em criação'),
        newIntegration('Ativa'),
        newIntegration('Revogada'),
        newIntegration('Com falha'),
      ];
      for (const i of [provisioning, active, revoked, failed]) {
        await sut.create(i);
      }
      active.activate('client-b', at(1));
      revoked.activate('client-c', at(1));
      revoked.revoke(anaId, at(2));
      failed.fail(at(1));
      for (const i of [active, revoked, failed]) await sut.save(i);

      expect(await sut.countLiveByOrganization(acmeId)).toBe(2);
    });

    it('listProvisioning: só PROVISIONING, de todas as organizações, da mais antiga à mais nova', async () => {
      const betaId = (await createOrganization('beta')).id;
      const recent = newIntegration('Recente', 5);
      const old = IntegrationClient.create(
        {
          organizationId: betaId,
          name: 'Antiga',
          scopes: [MachineScope.MEMBERS_READ],
          createdByUserId: anaId,
        },
        at(-30),
      );
      const active = newIntegration('Ativa');
      for (const i of [recent, old, active]) await sut.create(i);
      active.activate('client-a', at(1));
      await sut.save(active);

      const listed = await sut.listProvisioning();

      expect(listed.map((i) => [i.name, i.organizationId])).toEqual([
        ['Antiga', betaId],
        ['Recente', acmeId],
      ]);
    });

    it('escopo fora do catálogo vindo do banco: Error comum (500), não 400', async () => {
      await prisma.integrationClient.create({
        data: {
          clientId: 'client-velho',
          organizationId: acmeId,
          name: 'Velho',
          scopes: ['accessflow-api/escopo-removido'],
        },
      });

      await expect(sut.findByClientId('client-velho')).rejects.toThrow(
        /^IntegrationClient inválido vindo do banco: INVALID_INTEGRATION_CLIENT: /,
      );
    });
  });
});
