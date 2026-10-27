import { beforeEach, describe, expect, it } from 'vitest';
import { ListMyOrganizationsUseCase } from '@/modules/organizations/application/use-cases/list-my-organizations.use-case';
import { GetOrganizationUseCase } from '@/modules/organizations/application/use-cases/get-organization.use-case';
import { OrganizationAccessService } from '@/modules/organizations/application/services/organization-access.service';
import { RoleSystemKey } from '@/modules/organizations/domain/entities/role.entity';
import { SlugAlreadyTakenError } from '@/modules/organizations/domain/errors/slug-already-taken.error';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { InvalidOrganizationError } from '@/modules/organizations/domain/errors/invalid-organization.error';
import { UserNotFoundError } from '@/modules/identity/domain/errors/user-not-found.error';
import { InMemoryOrganizationRepository } from '@test/in-memory/organizations/in-memory-organization-repository';
import { InMemoryMembershipRepository } from '@test/in-memory/organizations/in-memory-membership-repository';
import { InMemoryRoleRepository } from '@test/in-memory/organizations/in-memory-role-repository';
import { FakeUserDirectory } from '@test/fakes/organizations/fake-user-directory';
import { FakeTransactionManager } from '@test/fakes/shared/fake-transaction-manager';
import { FixedClock } from '@test/fakes/shared/fixed-clock';
import { CreateOrganizationUseCase } from '@/modules/organizations/application/use-cases/create-organization.use-case';

const ANA = { sub: 'sub-ana', id: '11111111-1111-4111-8111-111111111111' };
const BRUNO = { sub: 'sub-bruno', id: '22222222-2222-4222-8222-222222222222' };

let roles: InMemoryRoleRepository;
let memberships: InMemoryMembershipRepository;
let organizations: InMemoryOrganizationRepository;
let users: FakeUserDirectory;
let createOrganization: CreateOrganizationUseCase;
let listMyOrganizations: ListMyOrganizationsUseCase;
let getOrganization: GetOrganizationUseCase;

describe('Casos de uso de organizations', () => {
  beforeEach(() => {
    roles = new InMemoryRoleRepository();
    memberships = new InMemoryMembershipRepository(roles);
    organizations = new InMemoryOrganizationRepository();
    users = new FakeUserDirectory();
    users.register(ANA.sub, ANA.id);
    users.register(BRUNO.sub, BRUNO.id);

    const access = new OrganizationAccessService(
      organizations,
      memberships,
      roles,
    );
    createOrganization = new CreateOrganizationUseCase(
      organizations,
      roles,
      memberships,
      users,
      new FakeTransactionManager(),
      new FixedClock(),
    );
    listMyOrganizations = new ListMyOrganizationsUseCase(
      organizations,
      memberships,
      roles,
      users,
    );
    getOrganization = new GetOrganizationUseCase(users, access);
  });

  describe('CreateOrganizationUseCase', () => {
    it('cria a organização e torna o criador OWNER', async () => {
      const { organization, membership } = await createOrganization.execute({
        cognitoSub: ANA.sub,
        name: 'Acme',
        slug: 'acme',
      });

      expect(organization.slug).toBe('acme');
      expect(membership.userId).toBe(ANA.id);
      expect(
        (await roles.findById(organization.id, membership.roleId))?.systemKey,
      ).toBe(RoleSystemKey.OWNER);
      expect(memberships.items).toHaveLength(1);
    });

    it('cria exatamente os dois papéis padrão, com members:read só no MEMBER', async () => {
      const { organization } = await createOrganization.execute({
        cognitoSub: ANA.sub,
        name: 'Acme',
        slug: 'acme',
      });

      expect(
        roles.items.map((role) => ({
          organizationId: role.organizationId,
          systemKey: role.systemKey,
          name: role.name,
          permissions: role.permissions,
        })),
      ).toEqual([
        {
          organizationId: organization.id,
          systemKey: RoleSystemKey.OWNER,
          name: 'Owner',
          permissions: [],
        },
        {
          organizationId: organization.id,
          systemKey: RoleSystemKey.MEMBER,
          name: 'Member',
          permissions: ['members:read'],
        },
      ]);
    });

    it('recusa slug já usado', async () => {
      await createOrganization.execute({
        cognitoSub: ANA.sub,
        name: 'Acme',
        slug: 'acme',
      });

      await expect(
        createOrganization.execute({
          cognitoSub: BRUNO.sub,
          name: 'Outra',
          slug: 'acme',
        }),
      ).rejects.toBeInstanceOf(SlugAlreadyTakenError);
    });

    it('recusa dados inválidos sem gravar nada', async () => {
      await expect(
        createOrganization.execute({
          cognitoSub: ANA.sub,
          name: 'Acme',
          slug: 'admin',
        }),
      ).rejects.toBeInstanceOf(InvalidOrganizationError);

      expect(organizations.items).toHaveLength(0);
    });

    it('exige perfil provisionado', async () => {
      await expect(
        createOrganization.execute({
          cognitoSub: 'sub-sem-perfil',
          name: 'Acme',
          slug: 'acme',
        }),
      ).rejects.toBeInstanceOf(UserNotFoundError);

      expect(organizations.items).toHaveLength(0);
    });
  });

  describe('ListMyOrganizationsUseCase', () => {
    it('lista só as organizações do próprio usuário', async () => {
      await createOrganization.execute({
        cognitoSub: ANA.sub,
        name: 'Acme',
        slug: 'acme',
      });
      await createOrganization.execute({
        cognitoSub: BRUNO.sub,
        name: 'Beta',
        slug: 'beta',
      });

      const result = await listMyOrganizations.execute(ANA.sub);

      expect(result.map((r) => r.organization.slug)).toEqual(['acme']);
    });

    it('não inclui memberships removidos', async () => {
      const { membership } = await createOrganization.execute({
        cognitoSub: ANA.sub,
        name: 'Acme',
        slug: 'acme',
      });
      membership.remove();

      expect(await listMyOrganizations.execute(ANA.sub)).toEqual([]);
    });
  });

  describe('GetOrganizationUseCase', () => {
    it('devolve a organização para um membro', async () => {
      const created = await createOrganization.execute({
        cognitoSub: ANA.sub,
        name: 'Acme',
        slug: 'acme',
      });

      const result = await getOrganization.execute({
        cognitoSub: ANA.sub,
        organizationId: created.organization.id,
      });

      expect(result.organization.id).toBe(created.organization.id);
      expect(result.role.systemKey).toBe(RoleSystemKey.OWNER);
    });

    it('responde NOT_FOUND para quem não é membro', async () => {
      const created = await createOrganization.execute({
        cognitoSub: ANA.sub,
        name: 'Acme',
        slug: 'acme',
      });

      await expect(
        getOrganization.execute({
          cognitoSub: BRUNO.sub,
          organizationId: created.organization.id,
        }),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });

    it('responde NOT_FOUND para membro removido', async () => {
      const created = await createOrganization.execute({
        cognitoSub: ANA.sub,
        name: 'Acme',
        slug: 'acme',
      });
      created.membership.remove();

      await expect(
        getOrganization.execute({
          cognitoSub: ANA.sub,
          organizationId: created.organization.id,
        }),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });

    it.each([
      ['id inexistente', '33333333-3333-4333-8333-333333333333'],
      ['id que não é UUID', 'nao-e-um-uuid'],
    ])('responde NOT_FOUND para %s', async (_cenario, organizationId) => {
      await expect(
        getOrganization.execute({ cognitoSub: ANA.sub, organizationId }),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    });
  });
});
