import { describe, expect, it } from 'vitest';
import {
  Invitation,
  InvitationStatus,
} from '@/modules/organizations/domain/entities/invitation.entity';
import { InvitationNotFoundError } from '@/modules/organizations/domain/errors/invitation-not-found.error';
import { InvalidInvitationError } from '@/modules/organizations/domain/errors/invalid-invitation.error';
import { InvalidEmailError } from '@/shared/domain/errors/invalid-email.error';

const DAY = 24 * 60 * 60 * 1000;
const CREATED_AT = new Date('2026-03-01T12:00:00.000Z');
const at = (ms: number) => new Date(CREATED_AT.getTime() + ms);

function makeInvitation(email = 'Bruno@Example.com') {
  return Invitation.create(
    {
      organizationId: 'org-1',
      email,
      roleId: 'role-member',
      invitedByUserId: 'user-ana',
    },
    CREATED_AT,
  );
}

describe('Invitation', () => {
  it('cria PENDING com e-mail normalizado e expiração em 7 dias', () => {
    const invitation = makeInvitation();

    expect(invitation.status).toBe(InvitationStatus.PENDING);
    expect(invitation.email).toBe('bruno@example.com');
    expect(invitation.expiresAt).toEqual(at(7 * DAY));
    expect(invitation.createdAt).toEqual(CREATED_AT);
    expect(invitation.updatedAt).toEqual(CREATED_AT);
  });

  it('recusa e-mail inválido com INVALID_EMAIL', () => {
    expect(() => makeInvitation('bruno@')).toThrow(InvalidEmailError);
  });

  it.each(['id', 'organizationId', 'roleId', 'invitedByUserId'] as const)(
    'restore exige %s',
    (field) => {
      const invitation = makeInvitation();

      expect(() =>
        Invitation.restore({
          id: invitation.id,
          organizationId: invitation.organizationId,
          email: invitation.email,
          roleId: invitation.roleId,
          status: invitation.status,
          invitedByUserId: invitation.invitedByUserId,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
          updatedAt: invitation.updatedAt,
          [field]: ' ',
        }),
      ).toThrow(InvalidInvitationError);
    },
  );

  describe('expiração', () => {
    it('está pendente até o último milissegundo antes de expiresAt', () => {
      const invitation = makeInvitation();

      expect(invitation.isPendingAt(at(7 * DAY - 1))).toBe(true);
      expect(invitation.isExpiredAt(at(7 * DAY - 1))).toBe(false);
    });

    it('expira exatamente em expiresAt', () => {
      const invitation = makeInvitation();

      expect(invitation.isPendingAt(at(7 * DAY))).toBe(false);
      expect(invitation.isExpiredAt(at(7 * DAY))).toBe(true);
      // Expirado é calculado: o status gravado continua PENDING.
      expect(invitation.status).toBe(InvitationStatus.PENDING);
    });

    it('convite respondido não é pendente nem expirado', () => {
      const invitation = makeInvitation();
      invitation.decline(at(DAY));

      expect(invitation.isPendingAt(at(8 * DAY))).toBe(false);
      expect(invitation.isExpiredAt(at(8 * DAY))).toBe(false);
    });
  });

  describe('renew', () => {
    it('troca papel e autor e recomeça os 7 dias a partir de agora', () => {
      const invitation = makeInvitation();

      invitation.renew(
        { roleId: 'role-owner', invitedByUserId: 'user-carla' },
        at(2 * DAY),
      );

      expect(invitation.roleId).toBe('role-owner');
      expect(invitation.invitedByUserId).toBe('user-carla');
      expect(invitation.expiresAt).toEqual(at(9 * DAY));
      expect(invitation.updatedAt).toEqual(at(2 * DAY));
      expect(invitation.createdAt).toEqual(CREATED_AT);
    });

    it('renova um convite já expirado', () => {
      const invitation = makeInvitation();

      invitation.renew(
        { roleId: 'role-member', invitedByUserId: 'user-ana' },
        at(10 * DAY),
      );

      expect(invitation.isPendingAt(at(10 * DAY))).toBe(true);
      expect(invitation.expiresAt).toEqual(at(17 * DAY));
    });

    it('não renova convite respondido', () => {
      const invitation = makeInvitation();
      invitation.revoke(at(DAY));

      expect(() =>
        invitation.renew(
          { roleId: 'role-member', invitedByUserId: 'user-ana' },
          at(2 * DAY),
        ),
      ).toThrow(InvitationNotFoundError);
    });
  });

  describe('transições', () => {
    it.each([
      ['accept', InvitationStatus.ACCEPTED],
      ['decline', InvitationStatus.DECLINED],
      ['revoke', InvitationStatus.REVOKED],
    ] as const)('%s leva a %s', (method, status) => {
      const invitation = makeInvitation();

      invitation[method](at(DAY));

      expect(invitation.status).toBe(status);
      expect(invitation.updatedAt).toEqual(at(DAY));
    });

    it.each(['accept', 'decline'] as const)(
      '%s recusa convite expirado sem mudar nada',
      (method) => {
        const invitation = makeInvitation();

        expect(() => invitation[method](at(7 * DAY))).toThrow(
          InvitationNotFoundError,
        );
        expect(invitation.status).toBe(InvitationStatus.PENDING);
        expect(invitation.updatedAt).toEqual(CREATED_AT);
      },
    );

    it('revoke vale para convite expirado', () => {
      const invitation = makeInvitation();

      invitation.revoke(at(8 * DAY));

      expect(invitation.status).toBe(InvitationStatus.REVOKED);
    });

    it.each([
      ['accept', 'accept'],
      ['accept', 'decline'],
      ['decline', 'accept'],
      ['decline', 'revoke'],
      ['revoke', 'accept'],
      ['revoke', 'revoke'],
    ] as const)(
      'depois de %s, %s lança INVITATION_NOT_FOUND',
      (first, second) => {
        const invitation = makeInvitation();
        invitation[first](at(DAY));
        const status = invitation.status;

        expect(() => invitation[second](at(2 * DAY))).toThrow(
          InvitationNotFoundError,
        );
        expect(invitation.status).toBe(status);
      },
    );
  });
});
