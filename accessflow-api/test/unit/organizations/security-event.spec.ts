import { describe, expect, it } from 'vitest';
import {
  SecurityEvent,
  SecurityEventProps,
} from '@/modules/organizations/domain/entities/security-event.entity';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const ORG = '11111111-1111-4111-8111-111111111111';
const USER = {
  type: 'USER',
  userId: '22222222-2222-4222-8222-222222222222',
} as const;
const MACHINE = { type: 'MACHINE', clientId: 'client-erp' } as const;
const ROUTE = 'GET /v1/organizations/:organizationId/members/:userId';

/** Um evento válido de cada tipo. */
const VALID: Record<string, Omit<SecurityEventProps, 'id' | 'occurredAt'>> = {
  'access.forbidden': {
    organizationId: ORG,
    actor: USER,
    event: 'access.forbidden',
    details: { operation: 'createRole', permission: 'roles:manage' },
  },
  'access.privilege_escalation': {
    organizationId: ORG,
    actor: USER,
    event: 'access.privilege_escalation',
    details: { operation: 'assignRole' },
  },
  'machine.scope_denied': {
    organizationId: null,
    actor: MACHINE,
    event: 'machine.scope_denied',
    details: { route: ROUTE, requiredScopes: ['accessflow-api/members.read'] },
  },
  'machine.organization_denied': {
    organizationId: ORG,
    actor: MACHINE,
    event: 'machine.organization_denied',
    details: { route: 'POST /v1/authorize' },
  },
};

function restore(
  event: keyof typeof VALID,
  overrides: Partial<SecurityEventProps> = {},
) {
  return SecurityEvent.restore({
    id: 'evento-1',
    occurredAt: NOW,
    ...VALID[event],
    ...overrides,
  });
}

describe('SecurityEvent', () => {
  it.each(Object.keys(VALID))('%s válido', (event) => {
    const created = restore(event);

    expect(created.event).toBe(event);
    expect(created.details).toEqual(VALID[event].details);
    expect(created.organizationId).toBe(VALID[event].organizationId);
  });

  it('create gera id e usa o instante informado', () => {
    const event = SecurityEvent.create(
      {
        organizationId: ORG,
        actor: USER,
        event: 'access.privilege_escalation',
        details: { operation: 'createRole' },
      },
      NOW,
    );

    expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(event.occurredAt).toBe(NOW);
  });

  it('evento fora do catálogo é recusado', () => {
    expect(() =>
      restore('access.forbidden', { event: 'access.denied' as never }),
    ).toThrow('evento desconhecido');
  });

  describe('ator', () => {
    it('evento de usuário com client, e de máquina com usuário, é recusado', () => {
      expect(() => restore('access.forbidden', { actor: MACHINE })).toThrow(
        'ator inválido',
      );
      expect(() => restore('machine.scope_denied', { actor: USER })).toThrow(
        'ator inválido',
      );
    });

    it('ator sem id é recusado', () => {
      expect(() =>
        restore('access.forbidden', { actor: { type: 'USER', userId: ' ' } }),
      ).toThrow('ator inválido');
      expect(() =>
        restore('machine.organization_denied', {
          actor: { type: 'MACHINE', clientId: '' },
        }),
      ).toThrow('ator inválido');
    });
  });

  describe('organização', () => {
    it('evento de usuário sempre tem organização', () => {
      expect(() =>
        restore('access.forbidden', { organizationId: null }),
      ).toThrow('sem organizationId');
    });

    it('evento de máquina pode não ter (client não cadastrado), mas não vazia', () => {
      expect(
        restore('machine.organization_denied', { organizationId: null })
          .organizationId,
      ).toBeNull();
      expect(() =>
        restore('machine.scope_denied', { organizationId: '' }),
      ).toThrow('sem organizationId');
    });
  });

  describe('details: exatamente as chaves do evento, só textos curtos', () => {
    it.each([
      ['falta uma chave', 'access.forbidden', { operation: 'createRole' }],
      [
        'chave a mais',
        'access.privilege_escalation',
        { operation: 'createRole', email: 'ana@example.com' },
      ],
      [
        'chave de outro evento',
        'machine.organization_denied',
        { operation: 'x' },
      ],
      ['texto vazio', 'access.privilege_escalation', { operation: '  ' }],
      ['número no lugar de texto', 'machine.organization_denied', { route: 1 }],
      [
        'texto acima do teto',
        'machine.organization_denied',
        { route: 'x'.repeat(SecurityEvent.MAX_DETAIL_LENGTH + 1) },
      ],
      [
        'escopos que não são lista',
        'machine.scope_denied',
        { route: ROUTE, requiredScopes: 'accessflow-api/authorize' },
      ],
      [
        'escopo vazio na lista',
        'machine.scope_denied',
        { route: ROUTE, requiredScopes: [''] },
      ],
      [
        'escopos acima do teto',
        'machine.scope_denied',
        {
          route: ROUTE,
          requiredScopes: Array.from(
            { length: SecurityEvent.MAX_REQUIRED_SCOPES + 1 },
            (_, i) => `s${i}`,
          ),
        },
      ],
    ])('%s é recusado', (_, event, details) => {
      expect(() => restore(event, { details })).toThrow();
    });

    it('lista de escopos vazia é aceita (rota sem @RequireScopes)', () => {
      expect(
        restore('machine.scope_denied', {
          details: { route: ROUTE, requiredScopes: [] },
        }).details,
      ).toEqual({ route: ROUTE, requiredScopes: [] });
    });

    it('details que não é objeto é recusado', () => {
      expect(() =>
        restore('access.forbidden', { details: [] as never }),
      ).toThrow('precisa ser um objeto');
    });

    it('a mensagem de erro não repete o conteúdo', () => {
      expect(() =>
        restore('access.privilege_escalation', {
          details: { operation: 'x'.repeat(500) },
        }),
      ).toThrow(
        /^SecurityEvent access.privilege_escalation: details.operation inválido.$/,
      );
    });
  });

  it('guarda cópias: mudar o objeto de origem não muda o evento', () => {
    const details = { route: ROUTE, requiredScopes: ['a/b'] };
    const event = restore('machine.scope_denied', { details });

    details.requiredScopes.push('c/d');

    expect(event.details).toEqual({ route: ROUTE, requiredScopes: ['a/b'] });
  });
});
