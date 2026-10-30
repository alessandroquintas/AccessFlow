import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { ClockPort } from '@/shared/application/ports/clock.port';
import { MachineScope } from '@/shared/domain/machine-scope';
import { IntegrationReconciliationModule } from '@/modules/organizations/integration-reconciliation.module';
import {
  MachineClientProvisioner,
  machineClientName,
} from '@/modules/organizations/application/ports/machine-client-provisioner.port';
import {
  ReconcileIntegrationClientsUseCase,
  STALE_PROVISIONING_MS,
} from '@/modules/organizations/application/use-cases/reconcile-integration-clients.use-case';
import { FakeMachineClientProvisioner } from '@test/fakes/organizations/fake-machine-client-provisioner';
import { FixedClock } from '@test/fakes/shared/fixed-clock';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const OLD = new Date(NOW.getTime() - STALE_PROVISIONING_MS - 60_000);
const RECENT = new Date(NOW.getTime() - 60_000);

let app: INestApplicationContext;
let prisma: PrismaService;
let cognito: FakeMachineClientProvisioner;
let sut: ReconcileIntegrationClientsUseCase;
let orgId: string;

async function insert(
  status: 'PROVISIONING' | 'ACTIVE' | 'REVOKED' | 'FAILED',
  createdAt: Date,
  clientId: string | null = null,
) {
  return prisma.integrationClient.create({
    data: {
      organizationId: orgId,
      name: `Integração ${status}`,
      scopes: [MachineScope.MEMBERS_READ],
      status,
      clientId,
      revokedAt: status === 'REVOKED' ? createdAt : null,
      createdAt,
      updatedAt: createdAt,
    },
  });
}

async function statusOf(id: string) {
  return (await prisma.integrationClient.findUniqueOrThrow({ where: { id } }))
    .status;
}

/** Espera alguma sessão do banco de teste ficar bloqueada numa trava. */
async function waitForLockWait(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: bigint }[]>`
      SELECT count(*) AS waiting FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'`;
    if (waiting > 0n) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('A reconciliação não esperou a trava da organização.');
}

describe('Reconciliação das integrações (integração)', () => {
  beforeAll(async () => {
    cognito = new FakeMachineClientProvisioner();
    const moduleRef = await Test.createTestingModule({
      imports: [IntegrationReconciliationModule],
    })
      .overrideProvider(MachineClientProvisioner)
      .useValue(cognito)
      .overrideProvider(ClockPort)
      .useValue(new FixedClock(NOW))
      .compile();
    app = await moduleRef.init();
    prisma = app.get(PrismaService);
    sut = app.get(ReconcileIntegrationClientsUseCase);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    cognito.reset();
    await prisma.$executeRaw`TRUNCATE TABLE "invitations", "integration_clients", "memberships", "organizations", "users" CASCADE`;
    orgId = (
      await prisma.organization.create({ data: { name: 'Acme', slug: 'acme' } })
    ).id;
  });

  describe('linha presa em PROVISIONING há mais de 15 minutos', () => {
    it('com client correspondente no Cognito: sem --apply só lista; com --apply vira FAILED e o client é apagado', async () => {
      const stuck = await insert('PROVISIONING', OLD);
      cognito.seed('c-stuck', machineClientName(stuck.id));

      const dryRun = await sut.execute({ apply: false });

      expect(dryRun.staleProvisioning).toEqual([
        {
          integrationId: stuck.id,
          organizationId: orgId,
          createdAt: OLD,
          clientIds: ['c-stuck'],
          outcome: 'pending',
        },
      ]);
      expect(dryRun.orphanClients).toEqual([]);
      expect(await statusOf(stuck.id)).toBe('PROVISIONING');
      expect(cognito.clients.has('c-stuck')).toBe(true);

      const applied = await sut.execute({ apply: true });

      expect(applied.staleProvisioning[0].outcome).toBe('done');
      const row = await prisma.integrationClient.findUniqueOrThrow({
        where: { id: stuck.id },
      });
      expect(row).toMatchObject({
        status: 'FAILED',
        clientId: null,
        updatedAt: NOW,
      });
      expect(cognito.deleted).toEqual(['c-stuck']);
      expect(cognito.clients.size).toBe(0);
    });

    it('sem client correspondente no Cognito: com --apply vira FAILED, sem apagar nada', async () => {
      const stuck = await insert('PROVISIONING', OLD);

      const dryRun = await sut.execute({ apply: false });
      expect(dryRun.staleProvisioning).toEqual([
        expect.objectContaining({ clientIds: [], outcome: 'pending' }),
      ]);
      expect(await statusOf(stuck.id)).toBe('PROVISIONING');

      const applied = await sut.execute({ apply: true });

      expect(applied.staleProvisioning[0].outcome).toBe('done');
      expect(await statusOf(stuck.id)).toBe('FAILED');
      expect(cognito.deleted).toEqual([]);
    });

    it('recente (menos de 15 minutos): fica, e o client dela também', async () => {
      const inFlight = await insert('PROVISIONING', RECENT);
      cognito.seed('c-in-flight', machineClientName(inFlight.id));

      const applied = await sut.execute({ apply: true });

      expect(applied).toEqual({
        apply: true,
        staleProvisioning: [],
        orphanClients: [],
      });
      expect(await statusOf(inFlight.id)).toBe('PROVISIONING');
      expect(cognito.clients.has('c-in-flight')).toBe(true);
    });

    it('a marcação espera a trava da organização; ativada enquanto isso, nada é feito e o client fica', async () => {
      const stuck = await insert('PROVISIONING', OLD);
      cognito.seed('c-late', machineClientName(stuck.id));

      let release!: () => void;
      const released = new Promise<void>((resolve) => (release = resolve));
      let locked!: () => void;
      const lockTaken = new Promise<void>((resolve) => (locked = resolve));
      // A criação no passo 3: trava a organização e ativa a linha.
      const creation = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId}::uuid FOR UPDATE`;
          locked();
          await released;
          await tx.integrationClient.update({
            where: { id: stuck.id },
            data: { status: 'ACTIVE', clientId: 'c-late' },
          });
        },
        { timeout: 10_000 },
      );
      await lockTaken;

      const reconciling = sut.execute({ apply: true });
      await waitForLockWait();
      release();
      await creation;
      const result = await reconciling;

      expect(result.staleProvisioning[0].outcome).toBe('skipped');
      expect(await statusOf(stuck.id)).toBe('ACTIVE');
      expect(cognito.deleted).toEqual([]);
      expect(cognito.clients.has('c-late')).toBe(true);
    });
  });

  it('app clients sem linha ACTIVE são apagados só com --apply; ACTIVE e sem prefixo nunca', async () => {
    const active = await insert('ACTIVE', RECENT, 'c-active');
    const revoked = await insert('REVOKED', RECENT, 'c-revoked');
    const failed = await insert('FAILED', RECENT);
    cognito.seed('c-active', machineClientName(active.id));
    cognito.seed('c-revoked', machineClientName(revoked.id));
    cognito.seed('c-failed', machineClientName(failed.id));
    cognito.seed('c-unknown', machineClientName(crypto.randomUUID()));
    cognito.seed('c-web', 'accessflow-web');
    cognito.seed('c-demo', 'accessflow-integration-demo');

    const dryRun = await sut.execute({ apply: false });
    expect(dryRun.orphanClients.map((o) => o.clientId)).toEqual([
      'c-revoked',
      'c-failed',
      'c-unknown',
    ]);
    expect(cognito.deleted).toEqual([]);

    await sut.execute({ apply: true });

    expect(cognito.deleted).toEqual(['c-revoked', 'c-failed', 'c-unknown']);
    expect([...cognito.clients.keys()]).toEqual([
      'c-active',
      'c-web',
      'c-demo',
    ]);
    expect(await statusOf(active.id)).toBe('ACTIVE');
  });
});
