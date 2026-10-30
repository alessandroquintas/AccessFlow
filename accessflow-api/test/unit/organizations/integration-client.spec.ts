import { describe, expect, it } from 'vitest';
import { DomainError } from '@/shared/domain/errors/domain.error';
import { MachineScope } from '@/shared/domain/machine-scope';
import {
  IntegrationClient,
  IntegrationClientProps,
  IntegrationClientStatus,
} from '@/modules/organizations/domain/entities/integration-client.entity';
import { IntegrationName } from '@/modules/organizations/domain/value-objects/integration-name.vo';
import { InvalidIntegrationClientError } from '@/modules/organizations/domain/errors/invalid-integration-client.error';
import { IntegrationNotActiveError } from '@/modules/organizations/domain/errors/integration-not-active.error';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const LATER = new Date('2026-03-01T12:05:00.000Z');
const ORG = '11111111-1111-4111-8111-111111111111';
const ANA = '22222222-2222-4222-8222-222222222222';
const BRUNO = '33333333-3333-4333-8333-333333333333';
const { MEMBERS_READ, AUTHORIZE } = MachineScope;

const newIntegration = (scopes: string[] = [MEMBERS_READ]) =>
  IntegrationClient.create(
    { organizationId: ORG, name: 'ERP', scopes, createdByUserId: ANA },
    NOW,
  );

function active(): IntegrationClient {
  const integration = newIntegration();
  integration.activate('client-erp', LATER);
  return integration;
}

function props(
  overrides: Partial<IntegrationClientProps> = {},
): IntegrationClientProps {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    organizationId: ORG,
    clientId: 'client-erp',
    name: 'ERP',
    scopes: [MEMBERS_READ],
    status: IntegrationClientStatus.ACTIVE,
    createdByUserId: ANA,
    revokedAt: null,
    revokedByUserId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('IntegrationName', () => {
  it('NFC, sem espaços nas pontas, espaços internos colapsados', () => {
    const decomposed = 'Integração'; // ç e ã decompostos

    expect(IntegrationName.create(`  ${decomposed}   do   ERP \t`).value).toBe(
      'Integração do ERP',
    );
  });

  it.each([
    ['vazio', ''],
    ['só espaços', '   '],
    ['1 caractere', 'a'],
    ['61 caracteres', 'a'.repeat(61)],
  ])('%s é recusado com INVALID_INTEGRATION_CLIENT', (_, raw) => {
    expect(() => IntegrationName.create(raw)).toThrow(
      InvalidIntegrationClientError,
    );
  });

  it('conta caracteres, e não unidades UTF-16: 60 emojis cabem', () => {
    expect([...IntegrationName.create('🚀'.repeat(60)).value]).toHaveLength(60);
    expect(() => IntegrationName.create('🚀'.repeat(61))).toThrow();
    expect(IntegrationName.create('ab').value).toBe('ab');
  });
});

describe('IntegrationClient', () => {
  describe('create', () => {
    it('nasce PROVISIONING, sem clientId, com quem criou', () => {
      const integration = newIntegration();

      expect(integration).toMatchObject({
        organizationId: ORG,
        clientId: null,
        name: 'ERP',
        status: IntegrationClientStatus.PROVISIONING,
        createdByUserId: ANA,
        revokedAt: null,
        revokedByUserId: null,
        createdAt: NOW,
      });
      expect(integration.isActive()).toBe(false);
      expect(integration.isLive()).toBe(true);
    });

    it('escopos sem repetição, na ordem do catálogo', () => {
      expect(
        newIntegration([AUTHORIZE, MEMBERS_READ, AUTHORIZE]).scopes,
      ).toEqual([MEMBERS_READ, AUTHORIZE]);
    });

    it.each([
      ['nenhum escopo', []],
      ['escopo fora do catálogo de máquina', ['accessflow-api/admin']],
      ['escopo de usuário', ['openid']],
    ])('%s: INVALID_INTEGRATION_CLIENT', (_, scopes) => {
      expect(() => newIntegration(scopes)).toThrow(
        InvalidIntegrationClientError,
      );
    });

    it('limite de vagas por organização: 5', () => {
      expect(IntegrationClient.MAX_LIVE_PER_ORGANIZATION).toBe(5);
    });
  });

  describe('ciclo de vida', () => {
    it('activate: PROVISIONING → ACTIVE com o clientId; só ACTIVE autoriza', () => {
      const integration = active();

      expect(integration).toMatchObject({
        status: IntegrationClientStatus.ACTIVE,
        clientId: 'client-erp',
        updatedAt: LATER,
      });
      expect(integration.isActive()).toBe(true);
      expect(integration.isLive()).toBe(true);
    });

    it('fail: PROVISIONING → FAILED, sem clientId, sem ocupar vaga', () => {
      const integration = newIntegration();

      integration.fail(LATER);

      expect(integration.status).toBe(IntegrationClientStatus.FAILED);
      expect(integration.clientId).toBeNull();
      expect(integration.isActive()).toBe(false);
      expect(integration.isLive()).toBe(false);
    });

    it('activate e fail fora de PROVISIONING são erro de programação (Error comum)', () => {
      const integration = active();

      for (const action of [
        () => integration.activate('outro', LATER),
        () => integration.fail(LATER),
      ]) {
        let error: unknown;
        try {
          action();
        } catch (e) {
          error = e;
        }
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(DomainError);
      }
      expect(() => newIntegration().activate(' ', LATER)).toThrow(
        'activate sem clientId.',
      );
    });

    it('revoke: ACTIVE → REVOKED com quando e quem; mantém o clientId', () => {
      const integration = active();

      expect(integration.revoke(BRUNO, LATER)).toBe(true);
      expect(integration).toMatchObject({
        status: IntegrationClientStatus.REVOKED,
        clientId: 'client-erp',
        revokedAt: LATER,
        revokedByUserId: BRUNO,
      });
      expect(integration.isActive()).toBe(false);
      expect(integration.isLive()).toBe(false);
    });

    it('revoke de novo: idempotente, nada muda', () => {
      const integration = active();
      integration.revoke(BRUNO, LATER);

      expect(integration.revoke(ANA, new Date())).toBe(false);
      expect(integration.revokedByUserId).toBe(BRUNO);
      expect(integration.revokedAt).toBe(LATER);
    });

    it('revoke em PROVISIONING ou FAILED: INTEGRATION_NOT_ACTIVE', () => {
      const failed = newIntegration();
      failed.fail(LATER);

      for (const integration of [newIntegration(), failed]) {
        expect(() => integration.revoke(ANA, LATER)).toThrow(
          IntegrationNotActiveError,
        );
      }
    });
  });

  describe('restore: a coerência do banco', () => {
    it.each([
      [
        'as anteriores ao painel (sem quem criou)',
        props({ createdByUserId: null }),
      ],
      [
        'PROVISIONING sem clientId',
        props({ status: 'PROVISIONING', clientId: null }),
      ],
      ['FAILED sem clientId', props({ status: 'FAILED', clientId: null })],
      [
        'REVOKED com revokedAt, sem quem revogou (antes do painel)',
        props({ status: 'REVOKED', revokedAt: NOW }),
      ],
    ])('aceita %s', (_, valid) => {
      expect(IntegrationClient.restore(valid).id).toBe(valid.id);
    });

    it.each([
      ['ACTIVE sem clientId', props({ clientId: null })],
      [
        'REVOKED sem clientId',
        props({ status: 'REVOKED', clientId: null, revokedAt: NOW }),
      ],
      ['PROVISIONING com clientId', props({ status: 'PROVISIONING' })],
      ['FAILED com clientId', props({ status: 'FAILED' })],
      ['REVOKED sem revokedAt', props({ status: 'REVOKED' })],
      ['ACTIVE com revokedAt', props({ revokedAt: NOW })],
      ['ACTIVE com quem revogou', props({ revokedByUserId: ANA })],
      ['escopos repetidos', props({ scopes: [MEMBERS_READ, MEMBERS_READ] })],
      ['sem escopos', props({ scopes: [] })],
      ['status desconhecido', props({ status: 'PAUSED' as never })],
      ['nome inválido', props({ name: 'x' })],
    ])('recusa %s com Error comum (500)', (_, corrupt) => {
      expect(() => IntegrationClient.restore(corrupt)).toThrow(
        /^IntegrationClient inválido vindo do banco: INVALID_INTEGRATION_CLIENT: /,
      );
    });
  });
});
