import { describe, expect, it } from 'vitest';
import { DomainError } from '@/shared/domain/errors/domain.error';
import { restoreFromStorage } from '@/shared/domain/restore-from-storage';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import { Membership } from '@/modules/organizations/domain/entities/membership.entity';
import { Role } from '@/modules/organizations/domain/entities/role.entity';
import { Invitation } from '@/modules/organizations/domain/entities/invitation.entity';
import { CustomPermission } from '@/modules/organizations/domain/entities/custom-permission.entity';
import { IntegrationClient } from '@/modules/organizations/domain/entities/integration-client.entity';
import { PermissionCatalog } from '@/modules/organizations/policies/organization-permission';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const ID = '11111111-1111-4111-8111-111111111111';

class SampleError extends DomainError {
  readonly code = 'SAMPLE';
}

function thrown(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('não lançou');
}

describe('restoreFromStorage', () => {
  it('devolve o que a construção devolve', () => {
    expect(restoreFromStorage('X', () => 42)).toBe(42);
  });

  it('DomainError vira Error comum, com o código, a mensagem e a causa', () => {
    const cause = new SampleError('campo obrigatório.');

    const error = thrown(() =>
      restoreFromStorage('X', () => {
        throw cause;
      }),
    );

    expect(error).not.toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      'X inválido vindo do banco: SAMPLE: campo obrigatório.',
    );
    expect((error as Error).cause).toBe(cause);
  });

  it('outro erro passa como está', () => {
    const other = new TypeError('quebrou');

    expect(
      thrown(() =>
        restoreFromStorage('X', () => {
          throw other;
        }),
      ),
    ).toBe(other);
  });
});

/**
 * Cada entidade: o restore de dado inválido lança Error comum (500), e o
 * create com a mesma entrada inválida continua com DomainError (400).
 */
describe.each([
  {
    entity: 'User',
    restore: () =>
      User.restore({
        id: ID,
        cognitoSub: 'sub',
        name: 'Ana',
        email: 'sem-arroba',
        status: 'ACTIVE',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    create: () =>
      User.create({ cognitoSub: 'sub', name: 'Ana', email: 'sem-arroba' }),
  },
  {
    entity: 'Organization',
    restore: () =>
      Organization.restore({
        id: ID,
        name: '',
        slug: 'acme',
        status: 'ACTIVE',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    create: () => Organization.create({ name: '', slug: 'acme' }),
  },
  {
    entity: 'Membership',
    restore: () =>
      Membership.restore({
        id: ID,
        organizationId: ID,
        userId: ID,
        roleId: ' ',
        status: 'ACTIVE',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    create: () =>
      Membership.create({ organizationId: ID, userId: ID, roleId: ' ' }),
  },
  {
    entity: 'Role',
    restore: () =>
      Role.restore({
        id: ID,
        organizationId: ID,
        name: '',
        description: null,
        systemKey: null,
        permissions: [],
        deletedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    create: () =>
      Role.create(
        { organizationId: ID, name: '', permissions: [] },
        PermissionCatalog.system(),
        NOW,
      ),
  },
  {
    entity: 'Invitation',
    restore: () =>
      Invitation.restore({
        id: ID,
        organizationId: ID,
        email: 'sem-arroba',
        roleId: ID,
        status: 'PENDING',
        invitedByUserId: ID,
        expiresAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    create: () =>
      Invitation.create(
        {
          organizationId: ID,
          email: 'sem-arroba',
          roleId: ID,
          invitedByUserId: ID,
        },
        NOW,
      ),
  },
  {
    entity: 'CustomPermission',
    restore: () =>
      CustomPermission.restore({
        id: ID,
        organizationId: ID,
        key: 'Fora:Do:Formato',
        description: 'Aprovar',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    create: () =>
      CustomPermission.create(
        { organizationId: ID, key: 'Fora:Do:Formato', description: 'Aprovar' },
        NOW,
      ),
  },
  {
    entity: 'IntegrationClient',
    restore: () =>
      IntegrationClient.restore({
        id: ID,
        organizationId: ID,
        clientId: null,
        name: 'ERP',
        scopes: ['accessflow-api/fora-do-catalogo' as never],
        status: 'PROVISIONING',
        createdByUserId: ID,
        revokedAt: null,
        revokedByUserId: null,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    create: () =>
      IntegrationClient.create(
        {
          organizationId: ID,
          name: 'ERP',
          scopes: ['accessflow-api/fora-do-catalogo'],
          createdByUserId: ID,
        },
        NOW,
      ),
  },
])('$entity', ({ entity, restore, create }) => {
  it('restore de dado corrompido: Error comum, não DomainError', () => {
    const error = thrown(restore);

    expect(error).not.toBeInstanceOf(DomainError);
    expect((error as Error).message).toMatch(
      new RegExp(`^${entity} inválido vindo do banco: [A-Z_]+: `),
    );
  });

  it('create com a mesma entrada inválida: DomainError, como antes', () => {
    expect(thrown(create)).toBeInstanceOf(DomainError);
  });
});
