import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Organization,
  OrganizationStatus,
} from '@/modules/organizations/domain/entities/organization.entity';
import {
  Membership,
  MembershipRole,
  MembershipStatus,
} from '@/modules/organizations/domain/entities/membership.entity';
import {
  Invitation,
  InvitationStatus,
} from '@/modules/organizations/domain/entities/invitation.entity';
import { OrganizationAccessService } from '@/modules/organizations/application/services/organization-access.service';
import {
  InviteMemberUseCase,
  MAX_PENDING_INVITATIONS_PER_ORGANIZATION,
} from '@/modules/organizations/application/use-cases/invite-member.use-case';
import { ListOrganizationInvitationsUseCase } from '@/modules/organizations/application/use-cases/list-organization-invitations.use-case';
import { RevokeInvitationUseCase } from '@/modules/organizations/application/use-cases/revoke-invitation.use-case';
import { ListMyInvitationsUseCase } from '@/modules/organizations/application/use-cases/list-my-invitations.use-case';
import { AcceptInvitationUseCase } from '@/modules/organizations/application/use-cases/accept-invitation.use-case';
import { DeclineInvitationUseCase } from '@/modules/organizations/application/use-cases/decline-invitation.use-case';
import { AlreadyMemberError } from '@/modules/organizations/domain/errors/already-member.error';
import { InvitationNotFoundError } from '@/modules/organizations/domain/errors/invitation-not-found.error';
import { InvitationLimitReachedError } from '@/modules/organizations/domain/errors/invitation-limit-reached.error';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { OrganizationPermissionDeniedError } from '@/modules/organizations/domain/errors/organization-permission-denied.error';
import { UserInactiveError } from '@/modules/identity/domain/errors/user-inactive.error';
import { InvalidEmailError } from '@/shared/domain/errors/invalid-email.error';
import { InMemoryOrganizationRepository } from '@test/in-memory/organizations/in-memory-organization-repository';
import { InMemoryMembershipRepository } from '@test/in-memory/organizations/in-memory-membership-repository';
import { InMemoryInvitationRepository } from '@test/in-memory/organizations/in-memory-invitation-repository';
import { FakeUserDirectory } from '@test/fakes/organizations/fake-user-directory';
import { FixedClock } from '@test/fakes/shared/fixed-clock';

const DAY = 24 * 60 * 60 * 1000;
const START = new Date('2026-03-01T12:00:00.000Z');

const OWNER = {
  sub: 'sub-owner',
  id: '11111111-1111-4111-8111-111111111111',
  email: 'olga@example.com',
};
const MEMBER = {
  sub: 'sub-member',
  id: '22222222-2222-4222-8222-222222222222',
  email: 'mario@example.com',
};
const INVITEE = {
  sub: 'sub-bruno',
  id: '33333333-3333-4333-8333-333333333333',
  email: 'bruno@example.com',
};
const OUTSIDER = {
  sub: 'sub-carla',
  id: '44444444-4444-4444-8444-444444444444',
  email: 'carla@example.com',
};

let clock: FixedClock;
let memberships: InMemoryMembershipRepository;
let organizations: InMemoryOrganizationRepository;
let invitations: InMemoryInvitationRepository;
let users: FakeUserDirectory;
let inviteMember: InviteMemberUseCase;
let listOrganizationInvitations: ListOrganizationInvitationsUseCase;
let revokeInvitation: RevokeInvitationUseCase;
let listMyInvitations: ListMyInvitationsUseCase;
let acceptInvitation: AcceptInvitationUseCase;
let declineInvitation: DeclineInvitationUseCase;
let acme: Organization;

function createOrganization(slug: string): Organization {
  const organization = Organization.create({ name: 'Acme', slug }, START);
  organizations.items.push(organization);
  return organization;
}

function addMember(
  organization: Organization,
  userId: string,
  role: MembershipRole,
): Membership {
  const membership = Membership.create(
    { organizationId: organization.id, userId, role },
    START,
  );
  memberships.items.push(membership);
  return membership;
}

function membershipOf(userId: string, organization = acme) {
  return memberships.items.filter(
    (m) => m.organizationId === organization.id && m.userId === userId,
  );
}

function deactivate(organization: Organization): void {
  organizations.items = organizations.items.map((o) =>
    o.id === organization.id
      ? Organization.restore({
          id: o.id,
          name: o.name,
          slug: o.slug,
          status: OrganizationStatus.INACTIVE,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        })
      : o,
  );
}

async function invite(
  email: string,
  role: MembershipRole = MembershipRole.MEMBER,
  organization = acme,
) {
  const { invitation } = await inviteMember.execute({
    cognitoSub: OWNER.sub,
    organizationId: organization.id,
    email,
    role,
  });
  return invitation;
}

describe('Convites', () => {
  beforeEach(() => {
    clock = new FixedClock(START);
    memberships = new InMemoryMembershipRepository();
    organizations = new InMemoryOrganizationRepository(memberships);
    invitations = new InMemoryInvitationRepository(memberships);
    users = new FakeUserDirectory();
    users.register(OWNER.sub, OWNER.id, { name: 'Olga', email: OWNER.email });
    users.register(MEMBER.sub, MEMBER.id, {
      name: 'Mário',
      email: MEMBER.email,
    });
    users.register(INVITEE.sub, INVITEE.id, {
      name: 'Bruno',
      email: INVITEE.email,
    });
    users.register(OUTSIDER.sub, OUTSIDER.id, { email: OUTSIDER.email });

    const access = new OrganizationAccessService(organizations, memberships);
    inviteMember = new InviteMemberUseCase(
      invitations,
      memberships,
      users,
      access,
      clock,
    );
    listOrganizationInvitations = new ListOrganizationInvitationsUseCase(
      invitations,
      users,
      access,
    );
    revokeInvitation = new RevokeInvitationUseCase(
      invitations,
      users,
      access,
      clock,
    );
    listMyInvitations = new ListMyInvitationsUseCase(
      invitations,
      organizations,
      users,
      clock,
    );
    acceptInvitation = new AcceptInvitationUseCase(
      invitations,
      organizations,
      users,
      clock,
    );
    declineInvitation = new DeclineInvitationUseCase(invitations, users, clock);

    acme = createOrganization('acme');
    addMember(acme, OWNER.id, MembershipRole.OWNER);
    addMember(acme, MEMBER.id, MembershipRole.MEMBER);
  });

  describe('InviteMemberUseCase', () => {
    it('OWNER convida: PENDING, expira em 7 dias e traz quem convidou', async () => {
      const result = await inviteMember.execute({
        cognitoSub: OWNER.sub,
        organizationId: acme.id,
        email: INVITEE.email,
        role: MembershipRole.MEMBER,
      });

      expect(result.invitation).toMatchObject({
        organizationId: acme.id,
        email: INVITEE.email,
        role: MembershipRole.MEMBER,
        status: InvitationStatus.PENDING,
        invitedByUserId: OWNER.id,
        expiresAt: new Date(START.getTime() + 7 * DAY),
      });
      expect(result.invitedBy).toEqual({ userId: OWNER.id, name: 'Olga' });
      expect(invitations.items).toHaveLength(1);
    });

    it('normaliza o e-mail e os ids recebidos', async () => {
      const { invitation } = await inviteMember.execute({
        cognitoSub: OWNER.sub,
        organizationId: acme.id.toUpperCase(),
        email: '  Bruno@Example.COM ',
        role: MembershipRole.MEMBER,
      });

      expect(invitation.email).toBe('bruno@example.com');
      expect(invitation.organizationId).toBe(acme.id);
    });

    it('OWNER pode convidar outro OWNER', async () => {
      const invitation = await invite(INVITEE.email, MembershipRole.OWNER);

      expect(invitation.role).toBe(MembershipRole.OWNER);
    });

    it('MEMBER não convida (FORBIDDEN)', async () => {
      await expect(
        inviteMember.execute({
          cognitoSub: MEMBER.sub,
          organizationId: acme.id,
          email: INVITEE.email,
          role: MembershipRole.MEMBER,
        }),
      ).rejects.toBeInstanceOf(OrganizationPermissionDeniedError);
      expect(invitations.items).toHaveLength(0);
    });

    it('convidar como OWNER exige ser OWNER, mesmo com members:invite', async () => {
      // Nenhum papel fixo tem members:invite sem ser OWNER; simula o que o
      // RBAC da Fase 8 vai permitir.
      // TODO(Fase 8): reescrever com um papel real que tenha members:invite
      // sem ser OWNER, quando houver papéis configuráveis, e remover o spy.
      const [member] = membershipOf(MEMBER.id);
      vi.spyOn(member, 'can').mockReturnValue(true);
      const input = {
        cognitoSub: MEMBER.sub,
        organizationId: acme.id,
        email: INVITEE.email,
      };

      await expect(
        inviteMember.execute({ ...input, role: MembershipRole.OWNER }),
      ).rejects.toBeInstanceOf(OrganizationPermissionDeniedError);
      expect(invitations.items).toHaveLength(0);

      const { invitation } = await inviteMember.execute({
        ...input,
        role: MembershipRole.MEMBER,
      });
      expect(invitation.invitedByUserId).toBe(MEMBER.id);
    });

    it('quem não é membro recebe ORGANIZATION_NOT_FOUND antes da validação do e-mail', async () => {
      await expect(
        inviteMember.execute({
          cognitoSub: OUTSIDER.sub,
          organizationId: acme.id,
          email: 'invalido',
          role: MembershipRole.MEMBER,
        }),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });

    it.each(['nao-e-uuid', '55555555-5555-4555-8555-555555555555'])(
      'organização inválida ou inexistente (%s): ORGANIZATION_NOT_FOUND',
      async (organizationId) => {
        await expect(
          inviteMember.execute({
            cognitoSub: OWNER.sub,
            organizationId,
            email: INVITEE.email,
            role: MembershipRole.MEMBER,
          }),
        ).rejects.toBeInstanceOf(OrganizationNotFoundError);
      },
    );

    it('recusa e-mail inválido com INVALID_EMAIL', async () => {
      await expect(invite('bruno@')).rejects.toBeInstanceOf(InvalidEmailError);
      expect(invitations.items).toHaveLength(0);
    });

    it('perfil inativo não convida', async () => {
      users.register(OWNER.sub, OWNER.id, {
        email: OWNER.email,
        active: false,
      });

      await expect(invite(INVITEE.email)).rejects.toBeInstanceOf(
        UserInactiveError,
      );
    });

    it.each([
      ['membro ativo', MEMBER.email],
      ['membro ativo, em maiúsculas', 'MARIO@EXAMPLE.COM'],
      ['o próprio autor', OWNER.email],
    ])('convidar %s: ALREADY_MEMBER', async (_cenario, email) => {
      await expect(invite(email)).rejects.toBeInstanceOf(AlreadyMemberError);
      expect(invitations.items).toHaveLength(0);
    });

    it('e-mail repetido: basta um dos perfis ser membro ativo', async () => {
      const notMember = '55555555-5555-4555-8555-555555555555';
      const member = '66666666-6666-4666-8666-666666666666';
      users.register('sub-dup-1', notMember, { email: 'dup@example.com' });
      users.register('sub-dup-2', member, { email: 'dup@example.com' });
      addMember(acme, member, MembershipRole.MEMBER);

      await expect(invite('dup@example.com')).rejects.toBeInstanceOf(
        AlreadyMemberError,
      );
    });

    it('membro removido pode ser convidado de novo', async () => {
      const [member] = membershipOf(MEMBER.id);
      member.remove(START);

      const invitation = await invite(MEMBER.email);

      expect(invitation.status).toBe(InvitationStatus.PENDING);
    });

    it('membro de outra organização pode ser convidado', async () => {
      const beta = createOrganization('beta');
      addMember(beta, INVITEE.id, MembershipRole.OWNER);

      await expect(invite(INVITEE.email)).resolves.toBeDefined();
    });

    it('reconvite renova: mesmo id, novo papel, novo autor e nova expiração', async () => {
      users.register('sub-owner-2', '77777777-7777-4777-8777-777777777777', {
        name: 'Paula',
      });
      addMember(
        acme,
        '77777777-7777-4777-8777-777777777777',
        MembershipRole.OWNER,
      );
      const first = await invite(INVITEE.email);
      clock.advance(2 * DAY);

      const result = await inviteMember.execute({
        cognitoSub: 'sub-owner-2',
        organizationId: acme.id,
        email: INVITEE.email,
        role: MembershipRole.OWNER,
      });

      expect(result.invitation.id).toBe(first.id);
      expect(result.invitation.role).toBe(MembershipRole.OWNER);
      expect(result.invitedBy.name).toBe('Paula');
      expect(result.invitation.expiresAt).toEqual(
        new Date(START.getTime() + 9 * DAY),
      );
      expect(invitations.items).toHaveLength(1);
    });

    it('reconvite renova também um convite expirado', async () => {
      const first = await invite(INVITEE.email);
      clock.advance(8 * DAY);

      const renewed = await invite(INVITEE.email);

      expect(renewed.id).toBe(first.id);
      expect(renewed.isPendingAt(clock.now())).toBe(true);
    });

    describe('limite de pendentes', () => {
      beforeEach(() => {
        invitations.seed(
          ...Array.from(
            { length: MAX_PENDING_INVITATIONS_PER_ORGANIZATION },
            (_, i) =>
              Invitation.create(
                {
                  organizationId: acme.id,
                  email: `pessoa-${i}@example.com`,
                  role: MembershipRole.MEMBER,
                  invitedByUserId: OWNER.id,
                },
                START,
              ),
          ),
        );
      });

      it('recusa o 51º convite pendente', async () => {
        expect(MAX_PENDING_INVITATIONS_PER_ORGANIZATION).toBe(50);

        await expect(invite(INVITEE.email)).rejects.toBeInstanceOf(
          InvitationLimitReachedError,
        );
      });

      it('convites expirados não ocupam vaga', async () => {
        clock.advance(7 * DAY);

        await expect(invite(INVITEE.email)).resolves.toBeDefined();
      });
    });
  });

  describe('ListOrganizationInvitationsUseCase', () => {
    it('lista pendentes, expirados incluídos, mais recentes primeiro, com quem convidou', async () => {
      const old = await invite('antigo@example.com');
      clock.advance(8 * DAY);
      const recent = await invite(INVITEE.email);
      const declined = await invite(OUTSIDER.email);
      clock.advance(1000);
      await declineInvitation.execute({
        cognitoSub: OUTSIDER.sub,
        invitationId: declined.id,
      });

      const page = await listOrganizationInvitations.execute({
        cognitoSub: OWNER.sub,
        organizationId: acme.id,
        first: 10,
      });

      expect(page.items.map((item) => item.invitation.id)).toEqual([
        recent.id,
        old.id,
      ]);
      expect(page.items[1].invitation.isExpiredAt(clock.now())).toBe(true);
      expect(page.items[0].invitedBy).toEqual({
        userId: OWNER.id,
        name: 'Olga',
      });
      expect(page.hasNextPage).toBe(false);
    });

    it('pagina com cursor', async () => {
      const first = await invite('a@example.com');
      clock.advance(1000);
      const second = await invite('b@example.com');

      const page1 = await listOrganizationInvitations.execute({
        cognitoSub: OWNER.sub,
        organizationId: acme.id,
        first: 1,
      });
      const last = page1.items[0].invitation;
      const page2 = await listOrganizationInvitations.execute({
        cognitoSub: OWNER.sub,
        organizationId: acme.id,
        first: 1,
        after: { createdAt: last.createdAt, id: last.id },
      });

      expect(page1.items[0].invitation.id).toBe(second.id);
      expect(page1.hasNextPage).toBe(true);
      expect(page2.items[0].invitation.id).toBe(first.id);
      expect(page2.hasNextPage).toBe(false);
    });

    it('MEMBER não lista (FORBIDDEN) e quem não é membro recebe NOT_FOUND', async () => {
      const input = { organizationId: acme.id, first: 10 };

      await expect(
        listOrganizationInvitations.execute({
          ...input,
          cognitoSub: MEMBER.sub,
        }),
      ).rejects.toBeInstanceOf(OrganizationPermissionDeniedError);
      await expect(
        listOrganizationInvitations.execute({
          ...input,
          cognitoSub: OUTSIDER.sub,
        }),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });
  });

  describe('RevokeInvitationUseCase', () => {
    it('revoga: o convite some do myInvitations do convidado', async () => {
      const invitation = await invite(INVITEE.email);
      clock.advance(DAY);

      await revokeInvitation.execute({
        cognitoSub: OWNER.sub,
        organizationId: acme.id.toUpperCase(),
        invitationId: invitation.id.toUpperCase(),
      });

      const stored = await invitations.findById(invitation.id);
      expect(stored?.status).toBe(InvitationStatus.REVOKED);
      expect(stored?.updatedAt).toEqual(clock.now());
      expect(
        await listMyInvitations.execute({ cognitoSub: INVITEE.sub }),
      ).toEqual([]);
    });

    it('revoga um convite expirado', async () => {
      const invitation = await invite(INVITEE.email);
      clock.advance(8 * DAY);

      await revokeInvitation.execute({
        cognitoSub: OWNER.sub,
        organizationId: acme.id,
        invitationId: invitation.id,
      });

      expect((await invitations.findById(invitation.id))?.status).toBe(
        InvitationStatus.REVOKED,
      );
    });

    it('convite de outra organização: NOT_FOUND, mesmo sendo OWNER das duas', async () => {
      const beta = createOrganization('beta');
      addMember(beta, OWNER.id, MembershipRole.OWNER);
      const invitation = await invite(INVITEE.email);

      await expect(
        revokeInvitation.execute({
          cognitoSub: OWNER.sub,
          organizationId: beta.id,
          invitationId: invitation.id,
        }),
      ).rejects.toBeInstanceOf(InvitationNotFoundError);
      expect((await invitations.findById(invitation.id))?.status).toBe(
        InvitationStatus.PENDING,
      );
    });

    it.each(['nao-e-uuid', '55555555-5555-4555-8555-555555555555'])(
      'convite inválido ou inexistente (%s): NOT_FOUND',
      async (invitationId) => {
        await expect(
          revokeInvitation.execute({
            cognitoSub: OWNER.sub,
            organizationId: acme.id,
            invitationId,
          }),
        ).rejects.toBeInstanceOf(InvitationNotFoundError);
      },
    );

    it('convite já respondido: NOT_FOUND', async () => {
      const invitation = await invite(INVITEE.email);
      await declineInvitation.execute({
        cognitoSub: INVITEE.sub,
        invitationId: invitation.id,
      });

      await expect(
        revokeInvitation.execute({
          cognitoSub: OWNER.sub,
          organizationId: acme.id,
          invitationId: invitation.id,
        }),
      ).rejects.toBeInstanceOf(InvitationNotFoundError);
      expect((await invitations.findById(invitation.id))?.status).toBe(
        InvitationStatus.DECLINED,
      );
    });

    it('MEMBER não revoga (FORBIDDEN)', async () => {
      const invitation = await invite(INVITEE.email);

      await expect(
        revokeInvitation.execute({
          cognitoSub: MEMBER.sub,
          organizationId: acme.id,
          invitationId: invitation.id,
        }),
      ).rejects.toBeInstanceOf(OrganizationPermissionDeniedError);
    });
  });

  describe('ListMyInvitationsUseCase', () => {
    it('mostra convites pendentes com a organização e o nome de quem convidou', async () => {
      const beta = createOrganization('beta');
      addMember(beta, OWNER.id, MembershipRole.OWNER);
      const fromAcme = await invite('BRUNO@Example.com');
      clock.advance(1000);
      const fromBeta = await invite(INVITEE.email, MembershipRole.OWNER, beta);

      const mine = await listMyInvitations.execute({
        cognitoSub: INVITEE.sub,
      });

      expect(mine.map((m) => m.invitation.id)).toEqual([
        fromBeta.id,
        fromAcme.id,
      ]);
      expect(mine[0].organization.id).toBe(beta.id);
      expect(mine[0].invitation.role).toBe(MembershipRole.OWNER);
      expect(mine[1].invitedByName).toBe('Olga');
    });

    it('convite expirado não aparece', async () => {
      await invite(INVITEE.email);
      clock.advance(7 * DAY - 1);
      expect(
        await listMyInvitations.execute({ cognitoSub: INVITEE.sub }),
      ).toHaveLength(1);

      clock.advance(1);
      expect(
        await listMyInvitations.execute({ cognitoSub: INVITEE.sub }),
      ).toEqual([]);
    });

    it('não mostra convites de organização inativa nem de outro e-mail', async () => {
      const beta = createOrganization('beta');
      addMember(beta, OWNER.id, MembershipRole.OWNER);
      await invite(INVITEE.email, MembershipRole.MEMBER, beta);
      await invite(OUTSIDER.email);
      deactivate(beta);

      expect(
        await listMyInvitations.execute({ cognitoSub: INVITEE.sub }),
      ).toEqual([]);
    });

    it('não mostra convites já respondidos', async () => {
      const invitation = await invite(INVITEE.email);
      await declineInvitation.execute({
        cognitoSub: INVITEE.sub,
        invitationId: invitation.id,
      });

      expect(
        await listMyInvitations.execute({ cognitoSub: INVITEE.sub }),
      ).toEqual([]);
    });
  });

  describe('AcceptInvitationUseCase', () => {
    it('cria o membership com o papel do convite e marca como aceito', async () => {
      const invitation = await invite(INVITEE.email, MembershipRole.OWNER);
      clock.advance(DAY);

      const result = await acceptInvitation.execute({
        cognitoSub: INVITEE.sub,
        invitationId: invitation.id,
      });

      expect(result.organization.id).toBe(acme.id);
      expect(result.membership).toMatchObject({
        userId: INVITEE.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
        createdAt: clock.now(),
      });
      expect(membershipOf(INVITEE.id)).toHaveLength(1);
      expect((await invitations.findById(invitation.id))?.status).toBe(
        InvitationStatus.ACCEPTED,
      );
    });

    it('e-mail do convite em maiúsculas casa com o do perfil', async () => {
      const invitation = await invite('BRUNO@EXAMPLE.COM');

      await expect(
        acceptInvitation.execute({
          cognitoSub: INVITEE.sub,
          invitationId: invitation.id.toUpperCase(),
        }),
      ).resolves.toBeDefined();
    });

    it('convite de outro e-mail: NOT_FOUND e nada muda', async () => {
      const invitation = await invite(INVITEE.email);

      await expect(
        acceptInvitation.execute({
          cognitoSub: OUTSIDER.sub,
          invitationId: invitation.id,
        }),
      ).rejects.toBeInstanceOf(InvitationNotFoundError);
      expect(membershipOf(OUTSIDER.id)).toHaveLength(0);
      expect((await invitations.findById(invitation.id))?.status).toBe(
        InvitationStatus.PENDING,
      );
    });

    it('convite expirado não pode ser aceito', async () => {
      const invitation = await invite(INVITEE.email);
      clock.advance(7 * DAY);

      await expect(
        acceptInvitation.execute({
          cognitoSub: INVITEE.sub,
          invitationId: invitation.id,
        }),
      ).rejects.toBeInstanceOf(InvitationNotFoundError);
      expect(membershipOf(INVITEE.id)).toHaveLength(0);
    });

    it.each(['revogado', 'recusado', 'aceito'] as const)(
      'convite já %s: NOT_FOUND',
      async (cenario) => {
        const invitation = await invite(INVITEE.email);
        const ref = { cognitoSub: INVITEE.sub, invitationId: invitation.id };
        if (cenario === 'revogado') {
          await revokeInvitation.execute({
            cognitoSub: OWNER.sub,
            organizationId: acme.id,
            invitationId: invitation.id,
          });
        } else if (cenario === 'recusado') {
          await declineInvitation.execute(ref);
        } else {
          await acceptInvitation.execute(ref);
        }

        await expect(acceptInvitation.execute(ref)).rejects.toBeInstanceOf(
          InvitationNotFoundError,
        );
      },
    );

    it.each(['nao-e-uuid', '55555555-5555-4555-8555-555555555555'])(
      'convite inválido ou inexistente (%s): NOT_FOUND',
      async (invitationId) => {
        await expect(
          acceptInvitation.execute({ cognitoSub: INVITEE.sub, invitationId }),
        ).rejects.toBeInstanceOf(InvitationNotFoundError);
      },
    );

    it('organização inativa: NOT_FOUND', async () => {
      const invitation = await invite(INVITEE.email);
      deactivate(acme);

      await expect(
        acceptInvitation.execute({
          cognitoSub: INVITEE.sub,
          invitationId: invitation.id,
        }),
      ).rejects.toBeInstanceOf(InvitationNotFoundError);
      expect(membershipOf(INVITEE.id)).toHaveLength(0);
    });

    it('com membership REMOVED, reativa o mesmo com o papel do convite', async () => {
      const old = addMember(acme, INVITEE.id, MembershipRole.OWNER);
      old.remove(START);
      const invitation = await invite(INVITEE.email, MembershipRole.MEMBER);
      clock.advance(DAY);

      const result = await acceptInvitation.execute({
        cognitoSub: INVITEE.sub,
        invitationId: invitation.id,
      });

      expect(result.membership.id).toBe(old.id);
      const stored = membershipOf(INVITEE.id);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        role: MembershipRole.MEMBER,
        status: MembershipStatus.ACTIVE,
        updatedAt: clock.now(),
        createdAt: START,
      });
    });

    it('já sendo membro ativo, consome o convite sem mudar o papel', async () => {
      const invitation = await invite(INVITEE.email, MembershipRole.OWNER);
      // Entrou por outro caminho depois do convite.
      addMember(acme, INVITEE.id, MembershipRole.MEMBER);

      const result = await acceptInvitation.execute({
        cognitoSub: INVITEE.sub,
        invitationId: invitation.id,
      });

      expect(result.membership.role).toBe(MembershipRole.MEMBER);
      expect(membershipOf(INVITEE.id)).toHaveLength(1);
      expect(membershipOf(INVITEE.id)[0].role).toBe(MembershipRole.MEMBER);
      expect((await invitations.findById(invitation.id))?.status).toBe(
        InvitationStatus.ACCEPTED,
      );
    });

    it('perfil inativo não aceita', async () => {
      const invitation = await invite(INVITEE.email);
      users.register(INVITEE.sub, INVITEE.id, {
        email: INVITEE.email,
        active: false,
      });

      await expect(
        acceptInvitation.execute({
          cognitoSub: INVITEE.sub,
          invitationId: invitation.id,
        }),
      ).rejects.toBeInstanceOf(UserInactiveError);
    });
  });

  describe('DeclineInvitationUseCase', () => {
    it('recusa sem criar membership', async () => {
      const invitation = await invite(INVITEE.email);
      clock.advance(DAY);

      await declineInvitation.execute({
        cognitoSub: INVITEE.sub,
        invitationId: invitation.id,
      });

      const stored = await invitations.findById(invitation.id);
      expect(stored?.status).toBe(InvitationStatus.DECLINED);
      expect(stored?.updatedAt).toEqual(clock.now());
      expect(membershipOf(INVITEE.id)).toHaveLength(0);
    });

    it('convite de outro e-mail: NOT_FOUND e nada muda', async () => {
      const invitation = await invite(INVITEE.email);

      await expect(
        declineInvitation.execute({
          cognitoSub: OUTSIDER.sub,
          invitationId: invitation.id,
        }),
      ).rejects.toBeInstanceOf(InvitationNotFoundError);
      expect((await invitations.findById(invitation.id))?.status).toBe(
        InvitationStatus.PENDING,
      );
    });

    it('convite expirado: NOT_FOUND', async () => {
      const invitation = await invite(INVITEE.email);
      clock.advance(7 * DAY);

      await expect(
        declineInvitation.execute({
          cognitoSub: INVITEE.sub,
          invitationId: invitation.id,
        }),
      ).rejects.toBeInstanceOf(InvitationNotFoundError);
    });

    it('convite já respondido: NOT_FOUND', async () => {
      const invitation = await invite(INVITEE.email);
      const ref = { cognitoSub: INVITEE.sub, invitationId: invitation.id };
      await declineInvitation.execute(ref);

      await expect(declineInvitation.execute(ref)).rejects.toBeInstanceOf(
        InvitationNotFoundError,
      );
    });
  });
});
