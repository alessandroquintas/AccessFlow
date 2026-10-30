import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import {
  Role,
  RoleSystemKey,
} from '@/modules/organizations/domain/entities/role.entity';
import {
  IntegrationClient,
  IntegrationClientStatus,
} from '@/modules/organizations/domain/entities/integration-client.entity';
import {
  AuditAction,
  AuditTargetType,
} from '@/modules/organizations/domain/entities/audit-event.entity';
import {
  OrganizationPermission,
  PermissionCatalog,
} from '@/modules/organizations/policies/organization-permission';
import { OrganizationAccessService } from '@/modules/organizations/application/services/organization-access.service';
import { CreateIntegrationClientUseCase } from '@/modules/organizations/application/use-cases/create-integration-client.use-case';
import { RevokeIntegrationClientUseCase } from '@/modules/organizations/application/use-cases/revoke-integration-client.use-case';
import { ListIntegrationClientsUseCase } from '@/modules/organizations/application/use-cases/list-integration-clients.use-case';
import {
  ReconcileIntegrationClientsUseCase,
  STALE_PROVISIONING_MS,
} from '@/modules/organizations/application/use-cases/reconcile-integration-clients.use-case';
import { machineClientName } from '@/modules/organizations/application/ports/machine-client-provisioner.port';
import { IntegrationProvisioningFailedError } from '@/modules/organizations/application/errors/integration-provisioning-failed.error';
import { InvalidIntegrationClientError } from '@/modules/organizations/domain/errors/invalid-integration-client.error';
import { IntegrationLimitReachedError } from '@/modules/organizations/domain/errors/integration-limit-reached.error';
import { IntegrationNotFoundError } from '@/modules/organizations/domain/errors/integration-not-found.error';
import { IntegrationNotActiveError } from '@/modules/organizations/domain/errors/integration-not-active.error';
import { PrivilegeEscalationError } from '@/modules/organizations/domain/errors/privilege-escalation.error';
import { OrganizationPermissionDeniedError } from '@/modules/organizations/domain/errors/organization-permission-denied.error';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { MachineScope } from '@/shared/domain/machine-scope';
import { InMemoryOrganizationRepository } from '@test/in-memory/organizations/in-memory-organization-repository';
import { InMemoryMembershipRepository } from '@test/in-memory/organizations/in-memory-membership-repository';
import { InMemoryRoleRepository } from '@test/in-memory/organizations/in-memory-role-repository';
import { InMemoryIntegrationClientRepository } from '@test/in-memory/organizations/in-memory-integration-client-repository';
import { InMemoryAuditLog } from '@test/in-memory/organizations/in-memory-audit-log';
import { FakeUserDirectory } from '@test/fakes/organizations/fake-user-directory';
import {
  FAKE_SECRET_MARKER,
  FakeMachineClientProvisioner,
} from '@test/fakes/organizations/fake-machine-client-provisioner';
import { FakeTransactionManager } from '@test/fakes/shared/fake-transaction-manager';
import { FixedClock } from '@test/fakes/shared/fixed-clock';
import { RecordingLogger } from '@test/fakes/shared/recording-logger';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const { MEMBERS_READ, ROLES_READ, INTEGRATIONS_READ, INTEGRATIONS_MANAGE } =
  OrganizationPermission;

const OWNER = { sub: 'sub-owner', id: '11111111-1111-4111-8111-111111111111' };
const MEMBER = {
  sub: 'sub-member',
  id: '22222222-2222-4222-8222-222222222222',
};
const MANAGER = {
  sub: 'sub-manager',
  id: '33333333-3333-4333-8333-333333333333',
};
const OUTSIDER = {
  sub: 'sub-outsider',
  id: '44444444-4444-4444-8444-444444444444',
};

let roles: InMemoryRoleRepository;
let memberships: InMemoryMembershipRepository;
let organizations: InMemoryOrganizationRepository;
let integrationClients: InMemoryIntegrationClientRepository;
let audit: InMemoryAuditLog;
let cognito: FakeMachineClientProvisioner;
let logger: RecordingLogger;
let clock: FixedClock;
let createIntegration: CreateIntegrationClientUseCase;
let revokeIntegration: RevokeIntegrationClientUseCase;
let listIntegrations: ListIntegrationClientsUseCase;
let reconcile: ReconcileIntegrationClientsUseCase;
let acme: Organization;
let beta: Organization;

function createOrganization(slug: string): Organization {
  const organization = Organization.create({ name: slug, slug }, NOW);
  organizations.items.push(organization);
  roles.seedDefaults(organization.id, NOW);
  return organization;
}

function addMember(userId: string, role: Role) {
  memberships.items.push(
    Membership.create(
      { organizationId: role.organizationId, userId, roleId: role.id },
      NOW,
    ),
  );
}

/** Gerente com integrations:manage e as permissões extras informadas. */
function seedManager(permissions: string[]) {
  const role = Role.create(
    {
      organizationId: acme.id,
      name: 'Integrações',
      permissions: [INTEGRATIONS_MANAGE, ...permissions],
    },
    PermissionCatalog.system(),
    NOW,
  );
  roles.seed(role);
  addMember(MANAGER.id, role);
}

/** Linha gravada direto, em qualquer status. */
function seedIntegration(
  status: IntegrationClientStatus,
  options: {
    organizationId?: string;
    clientId?: string;
    createdAt?: Date;
    createdByUserId?: string | null;
    name?: string;
  } = {},
): IntegrationClient {
  const withClient =
    status === IntegrationClientStatus.ACTIVE ||
    status === IntegrationClientStatus.REVOKED;
  const integration = IntegrationClient.restore({
    id: crypto.randomUUID(),
    organizationId: options.organizationId ?? acme.id,
    clientId: withClient ? (options.clientId ?? crypto.randomUUID()) : null,
    name: options.name ?? `Integração ${status}`,
    scopes: [MachineScope.MEMBERS_READ],
    status,
    createdByUserId:
      options.createdByUserId === undefined
        ? OWNER.id
        : options.createdByUserId,
    revokedAt: status === IntegrationClientStatus.REVOKED ? NOW : null,
    revokedByUserId: null,
    createdAt: options.createdAt ?? NOW,
    updatedAt: options.createdAt ?? NOW,
  });
  integrationClients.items.push(integration);
  return integration;
}

function stored(id: string): IntegrationClient {
  return integrationClients.items.find((i) => i.id === id)!;
}

function create(
  who: { sub: string },
  input: { name?: string; scopes?: string[] } = {},
) {
  return createIntegration.execute({
    cognitoSub: who.sub,
    organizationId: acme.id,
    name: input.name ?? 'ERP Financeiro',
    scopes: input.scopes ?? [MachineScope.MEMBERS_READ],
  });
}

function revoke(who: { sub: string }, integrationId: string) {
  return revokeIntegration.execute({
    cognitoSub: who.sub,
    organizationId: acme.id,
    integrationId,
  });
}

describe('Integrações self-service', () => {
  beforeEach(() => {
    clock = new FixedClock(NOW);
    roles = new InMemoryRoleRepository();
    memberships = new InMemoryMembershipRepository(roles);
    organizations = new InMemoryOrganizationRepository();
    integrationClients = new InMemoryIntegrationClientRepository();
    audit = new InMemoryAuditLog();
    cognito = new FakeMachineClientProvisioner();
    logger = new RecordingLogger();
    const users = new FakeUserDirectory();
    for (const [who, name] of [
      [OWNER, 'Ana'],
      [MEMBER, 'Bruno'],
      [MANAGER, 'Carla'],
      [OUTSIDER, 'Davi'],
    ] as const) {
      users.register(who.sub, who.id, { name });
    }

    const transactions = new FakeTransactionManager();
    const access = new OrganizationAccessService(
      organizations,
      memberships,
      roles,
    );
    createIntegration = new CreateIntegrationClientUseCase(
      organizations,
      integrationClients,
      cognito,
      users,
      access,
      audit,
      transactions,
      clock,
      logger,
    );
    revokeIntegration = new RevokeIntegrationClientUseCase(
      organizations,
      integrationClients,
      cognito,
      users,
      access,
      audit,
      transactions,
      clock,
      logger,
    );
    listIntegrations = new ListIntegrationClientsUseCase(
      integrationClients,
      users,
      access,
    );
    reconcile = new ReconcileIntegrationClientsUseCase(
      organizations,
      integrationClients,
      cognito,
      transactions,
      clock,
      logger,
    );

    acme = createOrganization('acme');
    beta = createOrganization('beta');
    addMember(OWNER.id, roles.systemRole(acme.id, RoleSystemKey.OWNER));
    addMember(MEMBER.id, roles.systemRole(acme.id, RoleSystemKey.MEMBER));
    addMember(OUTSIDER.id, roles.systemRole(beta.id, RoleSystemKey.OWNER));
  });

  afterEach(() => {
    // O segredo nunca vai para o log, a auditoria nem as linhas gravadas.
    const everything = JSON.stringify({
      logs: logger.lines,
      audit: audit.items.map((e) => ({ details: e.details })),
      rows: integrationClients.items.map((i) => ({
        ...i,
        props: (i as unknown as { props: unknown }).props,
      })),
    });
    expect(everything).not.toContain(FAKE_SECRET_MARKER);
  });

  describe('CreateIntegrationClientUseCase', () => {
    it('OWNER cria: ACTIVE com o client_id, segredo só no retorno, auditoria sem o segredo', async () => {
      clock.advance(1000);

      const { integration, clientSecret } = await create(OWNER, {
        name: '  ERP   Financeiro ',
        scopes: [
          MachineScope.AUTHORIZE,
          MachineScope.MEMBERS_READ,
          MachineScope.AUTHORIZE,
        ],
      });

      const { clientId, id } = integration.integration;
      expect(integration.integration).toMatchObject({
        organizationId: acme.id,
        name: 'ERP Financeiro',
        scopes: [MachineScope.MEMBERS_READ, MachineScope.AUTHORIZE],
        status: IntegrationClientStatus.ACTIVE,
        createdByUserId: OWNER.id,
        revokedAt: null,
      });
      expect(integration.createdBy).toEqual({ userId: OWNER.id, name: 'Ana' });
      expect(clientSecret).toBe(
        FakeMachineClientProvisioner.secretOf(clientId!),
      );
      expect(cognito.clients.get(clientId!)).toEqual({
        name: machineClientName(id),
        scopes: [MachineScope.MEMBERS_READ, MachineScope.AUTHORIZE],
      });
      expect(stored(id).status).toBe(IntegrationClientStatus.ACTIVE);

      const [event] = audit.items;
      expect(audit.items).toHaveLength(1);
      expect(event).toMatchObject({
        organizationId: acme.id,
        action: AuditAction.INTEGRATION_CREATED,
        target: { type: AuditTargetType.INTEGRATION, id },
        occurredAt: new Date(NOW.getTime() + 1000),
      });
      expect(event.details).toEqual({
        name: 'ERP Financeiro',
        scopes: [MachineScope.MEMBERS_READ, MachineScope.AUTHORIZE],
        clientId,
      });
      expect(logger.lines).toEqual([]);
    });

    it.each([
      ['nome curto', { name: 'x' }],
      ['sem escopo', { scopes: [] }],
      ['escopo fora do catálogo', { scopes: ['accessflow-api/admin'] }],
    ])(
      '%s: INVALID_INTEGRATION_CLIENT, sem linha e sem Cognito',
      async (_, input) => {
        await expect(create(OWNER, input)).rejects.toBeInstanceOf(
          InvalidIntegrationClientError,
        );
        expect(integrationClients.items).toEqual([]);
        expect(cognito.clients.size).toBe(0);
      },
    );

    it('MEMBER sem integrations:manage: negado; não membro: organização não encontrada', async () => {
      await expect(create(MEMBER)).rejects.toBeInstanceOf(
        OrganizationPermissionDeniedError,
      );
      await expect(create(OUTSIDER)).rejects.toBeInstanceOf(
        OrganizationNotFoundError,
      );
      expect(integrationClients.items).toEqual([]);
      expect(cognito.clients.size).toBe(0);
    });

    describe('anti-escalada de escopo', () => {
      it('members.read exige members:read; a negação leva a organização (vira evento)', async () => {
        seedManager([]);

        const error = await create(MANAGER).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(PrivilegeEscalationError);
        expect((error as PrivilegeEscalationError).securityDenial).toEqual({
          event: 'access.privilege_escalation',
          organizationId: acme.id,
        });
        expect(integrationClients.items).toEqual([]);
        expect(cognito.clients.size).toBe(0);
      });

      it('authorize exige members:read e roles:read', async () => {
        seedManager([MEMBERS_READ]);

        await expect(
          create(MANAGER, { scopes: [MachineScope.AUTHORIZE] }),
        ).rejects.toBeInstanceOf(PrivilegeEscalationError);
        const { integration } = await create(MANAGER, {
          scopes: [MachineScope.MEMBERS_READ],
        });
        expect(integration.integration.status).toBe(
          IntegrationClientStatus.ACTIVE,
        );
      });

      it('com members:read e roles:read concede os dois', async () => {
        seedManager([MEMBERS_READ, ROLES_READ]);

        const { integration } = await create(MANAGER, {
          scopes: Object.values(MachineScope),
        });
        expect(integration.integration.scopes).toEqual(
          Object.values(MachineScope),
        );
      });
    });

    describe('limite de 5 em criação ou ativas', () => {
      it('PROVISIONING e ACTIVE ocupam vaga: a sexta é recusada', async () => {
        seedIntegration(IntegrationClientStatus.PROVISIONING);
        seedIntegration(IntegrationClientStatus.PROVISIONING);
        for (let i = 0; i < 3; i++) await create(OWNER);

        await expect(create(OWNER)).rejects.toBeInstanceOf(
          IntegrationLimitReachedError,
        );
        expect(cognito.clients.size).toBe(3);
        expect(integrationClients.items).toHaveLength(5);
      });

      it('REVOKED e FAILED não ocupam vaga; outra organização também não', async () => {
        seedIntegration(IntegrationClientStatus.REVOKED);
        seedIntegration(IntegrationClientStatus.FAILED);
        for (let i = 0; i < 5; i++) {
          seedIntegration(IntegrationClientStatus.ACTIVE, {
            organizationId: beta.id,
          });
        }
        for (let i = 0; i < 5; i++) await create(OWNER);

        await expect(create(OWNER)).rejects.toBeInstanceOf(
          IntegrationLimitReachedError,
        );
      });

      it('revogar libera a vaga', async () => {
        const { integration: first } = await create(OWNER);
        for (let i = 0; i < 4; i++) await create(OWNER);
        await revoke(OWNER, first.integration.id);

        await expect(create(OWNER)).resolves.toBeDefined();
      });
    });

    describe('falhas', () => {
      it('Cognito fora do ar (passo 2): FAILED sem client_id, sem auditoria, erro mascarado, motivo no log', async () => {
        cognito.failCreate = new Error('ThrottlingException: Rate exceeded');

        const error = await create(OWNER).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(IntegrationProvisioningFailedError);
        expect((error as Error).message).not.toContain('Throttling');
        const [row] = integrationClients.items;
        expect(row).toMatchObject({
          status: IntegrationClientStatus.FAILED,
          clientId: null,
        });
        expect(audit.items).toEqual([]);
        expect(logger.lines).toHaveLength(1);
        expect(logger.lines[0]).toContain(
          `Cognito não criou o app client da integração ${row.id}.`,
        );
        expect(logger.lines[0]).toContain('ThrottlingException');
        // FAILED não ocupa vaga.
        expect(await integrationClients.countLiveByOrganization(acme.id)).toBe(
          0,
        );
      });

      it('falha ao ativar (passo 3): apaga o app client e deixa FAILED', async () => {
        const save = vi.spyOn(integrationClients, 'save');
        save.mockRejectedValueOnce(new Error('conexão perdida'));

        const error = await create(OWNER).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(IntegrationProvisioningFailedError);
        const [row] = integrationClients.items;
        expect(row.status).toBe(IntegrationClientStatus.FAILED);
        expect(cognito.clients.size).toBe(0);
        expect(cognito.deleted).toHaveLength(1);
        expect(audit.items).toEqual([]);
        expect(logger.lines).toEqual([
          expect.stringContaining(
            `Integração ${row.id} não foi ativada; apagando o app client ${cognito.deleted[0]}.`,
          ),
        ]);
      });

      it('passo 3 e compensação falham: log com o client que ficou, e a linha FAILED', async () => {
        const save = vi.spyOn(integrationClients, 'save');
        save.mockRejectedValueOnce(new Error('conexão perdida'));
        cognito.afterCreate = async () => {
          cognito.failDelete = new Error('Cognito indisponível');
        };

        await expect(create(OWNER)).rejects.toBeInstanceOf(
          IntegrationProvisioningFailedError,
        );

        const [row] = integrationClients.items;
        const [clientId] = cognito.clients.keys();
        expect(row.status).toBe(IntegrationClientStatus.FAILED);
        expect(logger.lines).toHaveLength(2);
        expect(logger.lines[1]).toContain(
          `Compensação falhou: o app client ${clientId} da integração ${row.id} continua no Cognito; a reconciliação o apaga.`,
        );
      });

      it('a reconciliação marcou FAILED durante a chamada ao Cognito: não ativa e apaga o client', async () => {
        cognito.afterCreate = async () => {
          const [row] = integrationClients.items;
          row.fail(NOW);
        };

        await expect(create(OWNER)).rejects.toBeInstanceOf(
          IntegrationProvisioningFailedError,
        );

        expect(integrationClients.items[0].status).toBe(
          IntegrationClientStatus.FAILED,
        );
        expect(cognito.clients.size).toBe(0);
        expect(audit.items).toEqual([]);
      });

      it('nem marcar FAILED dá certo: a linha fica em PROVISIONING, para a reconciliação', async () => {
        cognito.failCreate = new Error('Cognito indisponível');
        vi.spyOn(integrationClients, 'save').mockRejectedValue(
          new Error('banco fora do ar'),
        );

        await expect(create(OWNER)).rejects.toBeInstanceOf(
          IntegrationProvisioningFailedError,
        );

        const [row] = integrationClients.items;
        expect(row.status).toBe(IntegrationClientStatus.PROVISIONING);
        expect(logger.lines[1]).toContain(
          `Integração ${row.id} não foi marcada FAILED; fica em PROVISIONING até a reconciliação.`,
        );
      });
    });
  });

  describe('RevokeIntegrationClientUseCase', () => {
    it('revoga sob a trava, audita o client_id e depois apaga no Cognito', async () => {
      const { integration } = await create(OWNER);
      const { id, clientId } = integration.integration;
      clock.advance(5000);

      await revoke(OWNER, id.toUpperCase());

      expect(stored(id)).toMatchObject({
        status: IntegrationClientStatus.REVOKED,
        revokedAt: new Date(NOW.getTime() + 5000),
        revokedByUserId: OWNER.id,
        clientId,
      });
      expect(audit.items.at(-1)).toMatchObject({
        action: AuditAction.INTEGRATION_REVOKED,
        target: { type: AuditTargetType.INTEGRATION, id },
        details: { clientId },
      });
      expect(cognito.deleted).toEqual([clientId]);
    });

    it('já revogada: idempotente, sem evento e sem chamar o Cognito', async () => {
      const { integration } = await create(OWNER);
      await revoke(OWNER, integration.integration.id);

      await expect(
        revoke(OWNER, integration.integration.id),
      ).resolves.toBeUndefined();

      expect(audit.items).toHaveLength(2);
      expect(cognito.deleted).toHaveLength(1);
    });

    it('apagar no Cognito falha: continua revogada, e o log diz o que ficou', async () => {
      const { integration } = await create(OWNER);
      const { id, clientId } = integration.integration;
      cognito.failDelete = new Error('Cognito indisponível');

      await revoke(OWNER, id);

      expect(stored(id).status).toBe(IntegrationClientStatus.REVOKED);
      expect(logger.lines).toEqual([
        expect.stringContaining(
          `Integração ${id} revogada, mas o app client ${clientId} continua no Cognito; a reconciliação o apaga.`,
        ),
      ]);
    });

    it('inexistente, de outra organização ou id malformado: INTEGRATION_NOT_FOUND', async () => {
      const other = seedIntegration(IntegrationClientStatus.ACTIVE, {
        organizationId: beta.id,
      });

      for (const id of [crypto.randomUUID(), other.id, 'nao-e-uuid']) {
        await expect(revoke(OWNER, id)).rejects.toBeInstanceOf(
          IntegrationNotFoundError,
        );
      }
      expect(stored(other.id).status).toBe(IntegrationClientStatus.ACTIVE);
    });

    it.each([
      IntegrationClientStatus.PROVISIONING,
      IntegrationClientStatus.FAILED,
    ])('%s: INTEGRATION_NOT_ACTIVE', async (status) => {
      const integration = seedIntegration(status);

      await expect(revoke(OWNER, integration.id)).rejects.toBeInstanceOf(
        IntegrationNotActiveError,
      );
      expect(audit.items).toEqual([]);
    });

    it('sem integrations:manage: negado, e nada muda', async () => {
      const integration = seedIntegration(IntegrationClientStatus.ACTIVE);

      await expect(revoke(MEMBER, integration.id)).rejects.toBeInstanceOf(
        OrganizationPermissionDeniedError,
      );
      expect(stored(integration.id).status).toBe(
        IntegrationClientStatus.ACTIVE,
      );
      expect(cognito.deleted).toEqual([]);
    });
  });

  describe('ListIntegrationClientsUseCase', () => {
    it('todas, da mais nova à mais antiga, com o nome de quem criou; anteriores ao painel sem criador', async () => {
      const demo = seedIntegration(IntegrationClientStatus.ACTIVE, {
        createdByUserId: null,
        createdAt: new Date(NOW.getTime() - 60_000),
      });
      const failed = seedIntegration(IntegrationClientStatus.FAILED, {
        createdAt: new Date(NOW.getTime() - 30_000),
      });
      seedIntegration(IntegrationClientStatus.ACTIVE, {
        organizationId: beta.id,
      });
      clock.advance(1000);
      const { integration: created } = await create(OWNER);

      const result = await listIntegrations.execute({
        cognitoSub: OWNER.sub,
        organizationId: acme.id.toUpperCase(),
      });

      expect(
        result.map((r) => [r.integration.id, r.createdBy?.name ?? null]),
      ).toEqual([
        [created.integration.id, 'Ana'],
        [failed.id, 'Ana'],
        [demo.id, null],
      ]);
    });

    it('exige integrations:read', async () => {
      await expect(
        listIntegrations.execute({
          cognitoSub: MEMBER.sub,
          organizationId: acme.id,
        }),
      ).rejects.toBeInstanceOf(OrganizationPermissionDeniedError);

      const reader = Role.create(
        {
          organizationId: acme.id,
          name: 'Leitor',
          permissions: [INTEGRATIONS_READ],
        },
        PermissionCatalog.system(),
        NOW,
      );
      roles.seed(reader);
      addMember(MANAGER.id, reader);
      await expect(
        listIntegrations.execute({
          cognitoSub: MANAGER.sub,
          organizationId: acme.id,
        }),
      ).resolves.toEqual([]);
    });
  });

  describe('ReconcileIntegrationClientsUseCase', () => {
    const OLD = new Date(NOW.getTime() - STALE_PROVISIONING_MS - 1);
    // Mais antiga que OLD: a ordem das presas não depende do id sorteado.
    const OLDEST = new Date(OLD.getTime() - 60_000);

    /** Um cenário com cada caso; devolve as linhas e os clients. */
    function seedScenario() {
      const staleWithClient = seedIntegration(
        IntegrationClientStatus.PROVISIONING,
        { createdAt: OLDEST },
      );
      cognito.seed('c-stale', machineClientName(staleWithClient.id));
      const staleWithoutClient = seedIntegration(
        IntegrationClientStatus.PROVISIONING,
        { createdAt: OLD, organizationId: beta.id },
      );
      // Exatamente 15 minutos: ainda não está presa.
      const fresh = seedIntegration(IntegrationClientStatus.PROVISIONING, {
        createdAt: new Date(NOW.getTime() - STALE_PROVISIONING_MS),
      });
      cognito.seed('c-fresh', machineClientName(fresh.id));
      const active = seedIntegration(IntegrationClientStatus.ACTIVE, {
        clientId: 'c-active',
      });
      cognito.seed('c-active', machineClientName(active.id));
      const revoked = seedIntegration(IntegrationClientStatus.REVOKED, {
        clientId: 'c-revoked',
      });
      cognito.seed('c-revoked', machineClientName(revoked.id));
      const failed = seedIntegration(IntegrationClientStatus.FAILED);
      cognito.seed('c-failed', machineClientName(failed.id));
      cognito.seed('c-unknown', machineClientName(crypto.randomUUID()));
      // Sem o prefixo: nunca listados.
      cognito.seed('c-web', 'accessflow-web');
      cognito.seed('c-demo', 'accessflow-integration-demo');
      return { staleWithClient, staleWithoutClient, fresh, active };
    }

    it('sem apply: só lista, e nada muda', async () => {
      const { staleWithClient, staleWithoutClient } = seedScenario();

      const result = await reconcile.execute({ apply: false });

      expect(result).toEqual({
        apply: false,
        staleProvisioning: [
          {
            integrationId: staleWithClient.id,
            organizationId: acme.id,
            createdAt: OLDEST,
            clientIds: ['c-stale'],
            outcome: 'pending',
          },
          {
            integrationId: staleWithoutClient.id,
            organizationId: beta.id,
            createdAt: OLD,
            clientIds: [],
            outcome: 'pending',
          },
        ],
        orphanClients: [
          expect.objectContaining({
            clientId: 'c-revoked',
            outcome: 'pending',
          }),
          expect.objectContaining({ clientId: 'c-failed', outcome: 'pending' }),
          expect.objectContaining({
            clientId: 'c-unknown',
            outcome: 'pending',
          }),
        ],
      });
      expect(cognito.deleted).toEqual([]);
      expect(cognito.clients.size).toBe(8);
      expect(
        integrationClients.items.filter(
          (i) => i.status === IntegrationClientStatus.PROVISIONING,
        ),
      ).toHaveLength(3);
    });

    it('com apply: presas viram FAILED (com e sem client), órfãos são apagados; o resto fica', async () => {
      const { staleWithClient, staleWithoutClient, fresh, active } =
        seedScenario();
      const lock = vi.spyOn(organizations, 'lock');

      const result = await reconcile.execute({ apply: true });

      expect(result.staleProvisioning.map((s) => s.outcome)).toEqual([
        'done',
        'done',
      ]);
      expect(result.orphanClients.map((o) => o.outcome)).toEqual([
        'done',
        'done',
        'done',
      ]);
      expect(stored(staleWithClient.id).status).toBe(
        IntegrationClientStatus.FAILED,
      );
      expect(stored(staleWithoutClient.id).status).toBe(
        IntegrationClientStatus.FAILED,
      );
      expect(stored(fresh.id).status).toBe(
        IntegrationClientStatus.PROVISIONING,
      );
      expect(stored(active.id).status).toBe(IntegrationClientStatus.ACTIVE);
      expect(cognito.deleted.sort()).toEqual(
        ['c-failed', 'c-revoked', 'c-stale', 'c-unknown'].sort(),
      );
      expect([...cognito.clients.keys()].sort()).toEqual(
        ['c-active', 'c-demo', 'c-fresh', 'c-web'].sort(),
      );
      // A marcação seguiu a trava da organização de cada linha.
      expect(lock.mock.calls.flat().sort()).toEqual([acme.id, beta.id].sort());
    });

    it('ativada antes da trava: nada é feito, e o client dela fica', async () => {
      const stale = seedIntegration(IntegrationClientStatus.PROVISIONING, {
        createdAt: OLD,
      });
      cognito.seed('c-late', machineClientName(stale.id));
      vi.spyOn(organizations, 'lock').mockImplementation(async () => {
        stored(stale.id).activate('c-late', NOW);
      });

      const result = await reconcile.execute({ apply: true });

      expect(result.staleProvisioning[0].outcome).toBe('skipped');
      expect(stored(stale.id).status).toBe(IntegrationClientStatus.ACTIVE);
      expect(cognito.deleted).toEqual([]);
    });

    it('apagar falha: erro no resultado e no log; a linha fica FAILED e a próxima execução tenta de novo', async () => {
      const stale = seedIntegration(IntegrationClientStatus.PROVISIONING, {
        createdAt: OLD,
      });
      cognito.seed('c-stale', machineClientName(stale.id));
      cognito.seed('c-orphan', machineClientName(crypto.randomUUID()));
      cognito.failDelete = new Error('Cognito indisponível');

      const result = await reconcile.execute({ apply: true });

      expect(result.staleProvisioning[0].outcome).toBe('error');
      expect(result.orphanClients[0].outcome).toBe('error');
      expect(stored(stale.id).status).toBe(IntegrationClientStatus.FAILED);
      expect(logger.lines).toEqual([
        expect.stringContaining('App client c-stale não foi apagado.'),
        expect.stringContaining('App client c-orphan não foi apagado.'),
      ]);

      cognito.failDelete = null;
      const again = await reconcile.execute({ apply: true });
      expect(again.staleProvisioning).toEqual([]);
      expect(again.orphanClients.map((o) => [o.clientId, o.outcome])).toEqual([
        ['c-stale', 'done'],
        ['c-orphan', 'done'],
      ]);
    });
  });
});
