import { describe, expect, it } from 'vitest';
import {
  AuthorizationDecision,
  AuthorizationDecisionProps,
} from '@/modules/organizations/domain/entities/authorization-decision.entity';

const NOW = new Date('2026-03-01T12:00:00.000Z');

function props(
  overrides: Partial<AuthorizationDecisionProps> = {},
): AuthorizationDecisionProps {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    organizationId: '22222222-2222-4222-8222-222222222222',
    clientId: 'client-acme',
    subjectUserId: '33333333-3333-4333-8333-333333333333',
    results: [
      { permission: 'invoices:approve', allowed: true },
      { permission: 'members:read', allowed: true },
    ],
    decidedAt: NOW,
    ...overrides,
  };
}

describe('AuthorizationDecision', () => {
  it('create gera o id e guarda o instante da decisão', () => {
    const { id, decidedAt, ...input } = props();
    const decision = AuthorizationDecision.create(input, decidedAt);

    expect(decision.id).not.toBe(id);
    expect(decision.decidedAt).toBe(NOW);
    expect(decision.results).toEqual(input.results);
  });

  it('allowed sai dos resultados: true só se todos forem', () => {
    expect(AuthorizationDecision.restore(props()).allowed).toBe(true);
    expect(
      AuthorizationDecision.restore(
        props({
          results: [
            { permission: 'invoices:approve', allowed: true },
            { permission: 'members:read', allowed: false },
          ],
        }),
      ).allowed,
    ).toBe(false);
  });

  it('copia os resultados: mudar a lista de entrada não muda a decisão', () => {
    const results = [{ permission: 'invoices:approve', allowed: true }];
    const decision = AuthorizationDecision.restore(props({ results }));

    results[0].allowed = false;
    results.push({ permission: 'members:read', allowed: false });

    expect(decision.results).toEqual([
      { permission: 'invoices:approve', allowed: true },
    ]);
    expect(decision.allowed).toBe(true);
  });

  it.each([
    ['sem id', props({ id: '' })],
    ['sem organização', props({ organizationId: ' ' })],
    ['sem client', props({ clientId: '' })],
    ['sem sujeito', props({ subjectUserId: '' })],
    ['sem resultados', props({ results: [] })],
    [
      'chave repetida',
      props({
        results: [
          { permission: 'a:b', allowed: true },
          { permission: 'a:b', allowed: false },
        ],
      }),
    ],
    [
      'resultado malformado',
      props({
        results: [{ permission: 'a:b', allowed: 'sim' as unknown as boolean }],
      }),
    ],
  ])('%s: Error, não DomainError (é bug de quem montou)', (_, invalid) => {
    expect(() => AuthorizationDecision.restore(invalid)).toThrow(Error);
  });
});
