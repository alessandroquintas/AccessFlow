import { describe, expect, it } from 'vitest';
import {
  AuditAction,
  AuditActorType,
  AuditEvent,
  AuditTargetType,
  TARGET_TYPE_BY_ACTION,
  isAuditAction,
  isAuditTargetType,
} from '@/modules/organizations/domain/entities/audit-event.entity';
import { DomainError } from '@/shared/domain/errors/domain.error';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const USER = { type: AuditActorType.USER, userId: 'user-1' } as const;

function roleCreated(permissions: string[], name = 'Financeiro') {
  return AuditEvent.create(
    {
      organizationId: 'org-1',
      actor: USER,
      action: AuditAction.ROLE_CREATED,
      targetId: 'role-1',
      details: { name, permissions },
    },
    NOW,
  );
}

describe('Catálogo de ações', () => {
  it('tem exatamente as 16 ações da tabela, com o tipo de alvo de cada uma', () => {
    expect(TARGET_TYPE_BY_ACTION).toEqual({
      'organization.created': 'organization',
      'organization.updated': 'organization',
      'member.removed': 'member',
      'member.left': 'member',
      'member.role_changed': 'member',
      'invitation.created': 'invitation',
      'invitation.renewed': 'invitation',
      'invitation.revoked': 'invitation',
      'invitation.accepted': 'invitation',
      'invitation.declined': 'invitation',
      'role.created': 'role',
      'role.updated': 'role',
      'role.deleted': 'role',
      'permission.created': 'permission',
      'permission.updated': 'permission',
      'permission.deleted': 'permission',
    });
    expect(Object.values(AuditTargetType).sort()).toEqual(
      ['invitation', 'member', 'organization', 'permission', 'role'].sort(),
    );
  });

  it('isAuditAction e isAuditTargetType só aceitam valores do catálogo', () => {
    expect(isAuditAction('role.created')).toBe(true);
    expect(isAuditAction('role.renamed')).toBe(false);
    expect(isAuditAction('ROLE.CREATED')).toBe(false);
    expect(isAuditTargetType('member')).toBe(true);
    expect(isAuditTargetType('user')).toBe(false);
  });
});

describe('AuditEvent', () => {
  it('create: id novo, alvo pelo tipo da ação e o instante informado', () => {
    const event = AuditEvent.create(
      {
        organizationId: 'org-1',
        actor: USER,
        action: AuditAction.MEMBER_ROLE_CHANGED,
        targetId: 'user-2',
        details: { fromRoleId: 'role-a', toRoleId: 'role-b' },
      },
      NOW,
    );

    expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(event).toMatchObject({
      organizationId: 'org-1',
      actor: USER,
      action: 'member.role_changed',
      target: { type: 'member', id: 'user-2' },
      details: { fromRoleId: 'role-a', toRoleId: 'role-b' },
      occurredAt: NOW,
    });
  });

  it('guarda uma cópia do details: mudar o objeto de origem não muda o evento', () => {
    const permissions = ['members:read'];
    const event = roleCreated(permissions);

    permissions.push('roles:manage');

    expect(event.details).toEqual({
      name: 'Financeiro',
      permissions: ['members:read'],
    });
  });

  it('aceita os tipos de ator MACHINE e SYSTEM (preparados para a 9b)', () => {
    for (const actor of [
      { type: AuditActorType.MACHINE, clientId: 'client-erp' },
      { type: AuditActorType.SYSTEM },
    ] as const) {
      expect(
        AuditEvent.restore({
          id: 'evt-1',
          organizationId: 'org-1',
          actor,
          action: AuditAction.ROLE_DELETED,
          target: { type: 'role', id: 'role-1' },
          details: { name: 'Antigo' },
          occurredAt: NOW,
        }).actor,
      ).toEqual(actor);
    }
  });

  describe('falha fechada: erro interno (Error), e não DomainError', () => {
    const base = {
      id: 'evt-1',
      organizationId: 'org-1',
      actor: USER,
      action: AuditAction.ROLE_DELETED,
      target: { type: AuditTargetType.ROLE, id: 'role-1' },
      details: { name: 'Antigo' },
      occurredAt: NOW,
    };

    it.each([
      ['sem id', { id: ' ' }],
      ['sem organizationId', { organizationId: '' }],
      ['ação fora do catálogo', { action: 'role.renamed' }],
      ['alvo que não é o da ação', { target: { type: 'member', id: 'x' } }],
      ['alvo sem id', { target: { type: 'role', id: '' } }],
      ['USER sem userId', { actor: { type: 'USER', userId: '' } }],
      ['MACHINE sem clientId', { actor: { type: 'MACHINE', clientId: ' ' } }],
      ['ator desconhecido', { actor: { type: 'ROBOT' } }],
      ['details que não é objeto', { details: ['a'] }],
    ])('%s', (_, override) => {
      const build = () => AuditEvent.restore({ ...base, ...override } as never);

      expect(build).toThrow(Error);
      try {
        build();
      } catch (error) {
        expect(error).not.toBeInstanceOf(DomainError);
      }
    });
  });

  describe('limite de tamanho do details', () => {
    it('é 16 KB e cobre o maior details legítimo (papel com o catálogo efetivo inteiro)', () => {
      expect(AuditEvent.MAX_DETAILS_BYTES).toBe(16 * 1024);
      // 9 de sistema + 100 personalizadas com 40 + 1 + 40 caracteres.
      const permissions = [
        ...Array.from({ length: 9 }, (_, i) => `sistema-${i}:acao`),
        ...Array.from(
          { length: 100 },
          (_, i) =>
            `${'r'.repeat(37)}${String(i).padStart(3, '0')}:${'a'.repeat(40)}`,
        ),
      ];
      const event = AuditEvent.create(
        {
          organizationId: 'org-1',
          actor: USER,
          action: AuditAction.ROLE_UPDATED,
          targetId: 'role-1',
          details: {
            changes: {
              name: { from: 'ã'.repeat(50), to: 'é'.repeat(50) },
              permissionsAdded: permissions.slice(0, 55),
              permissionsRemoved: permissions.slice(55),
            },
          },
        },
        NOW,
      );

      expect(
        new TextEncoder().encode(JSON.stringify(event.details)).length,
      ).toBeLessThan(AuditEvent.MAX_DETAILS_BYTES);
    });

    it('acima do limite: erro interno com o tamanho, sem o conteúdo na mensagem', () => {
      const huge = 'segredo-'.repeat(2100);

      let error: unknown;
      try {
        roleCreated([], huge);
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(DomainError);
      expect((error as Error).message).toMatch(/\d+ bytes; o limite é 16384/);
      expect((error as Error).message).not.toContain('segredo');
    });

    it('conta bytes UTF-8, não caracteres', () => {
      // 6 000 "ã" = 12 000 bytes: cabe; 9 000 = 18 000 bytes: não cabe.
      expect(() => roleCreated([], 'ã'.repeat(6000))).not.toThrow();
      expect(() => roleCreated([], 'ã'.repeat(9000))).toThrow(/bytes/);
    });
  });
});
