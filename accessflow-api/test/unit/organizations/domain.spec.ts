import { describe, expect, it } from 'vitest';
import { Slug } from '@/modules/organizations/domain/value-objects/slug.vo';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import {
  Membership,
  MembershipStatus,
} from '@/modules/organizations/domain/entities/membership.entity';
import { Role } from '@/modules/organizations/domain/entities/role.entity';
import { InvalidOrganizationError } from '@/modules/organizations/domain/errors/invalid-organization.error';
import { InvalidMembershipError } from '@/modules/organizations/domain/errors/invalid-membership.error';

describe('Slug', () => {
  it.each(['acme', 'acme-corp', 'time-2026', 'abc'])('aceita "%s"', (raw) => {
    expect(Slug.create(raw).value).toBe(raw);
  });

  it('normaliza para minúsculas e remove espaços nas pontas', () => {
    expect(Slug.create('  ACME-Corp ').value).toBe('acme-corp');
  });

  it.each([
    ['curto demais', 'ab'],
    ['longo demais', 'a'.repeat(51)],
    ['hífen no início', '-acme'],
    ['hífen no fim', 'acme-'],
    ['hífen duplo', 'acme--corp'],
    ['espaço interno', 'acme corp'],
    ['underscore', 'acme_corp'],
    ['acento', 'acmé'],
  ])('recusa %s', (_cenario, raw) => {
    expect(() => Slug.create(raw)).toThrow(InvalidOrganizationError);
  });

  it('recusa palavras reservadas em slugs novos', () => {
    expect(() => Slug.create('admin')).toThrow(InvalidOrganizationError);
  });

  it('aceita palavra reservada ao restaurar um slug já persistido', () => {
    expect(Slug.restore('admin').value).toBe('admin');
  });
});

describe('Organization', () => {
  it('cria organização ativa com nome e slug normalizados', () => {
    const organization = Organization.create({
      name: '  Acme Corp  ',
      slug: 'ACME',
    });

    expect(organization.name).toBe('Acme Corp');
    expect(organization.slug).toBe('acme');
    expect(organization.isActive()).toBe(true);
  });

  it('renomeia validando o novo nome', () => {
    const organization = Organization.create({ name: 'Acme', slug: 'acme' });
    const later = new Date(organization.updatedAt.getTime() + 1000);

    organization.rename('Acme Global', later);

    expect(organization.name).toBe('Acme Global');
    expect(organization.updatedAt).toEqual(later);
    expect(() => organization.rename(' ')).toThrow(InvalidOrganizationError);
  });
});

describe('Membership', () => {
  const { owner, member } = Role.createDefaults('org-1', new Date());

  it('cria o OWNER ativo', () => {
    const membership = Membership.create({
      organizationId: 'org-1',
      userId: 'user-1',
      roleId: owner.id,
    });

    expect(membership.roleId).toBe(owner.id);
    expect(membership.isActive()).toBe(true);
    expect(owner.isOwner()).toBe(true);
  });

  it('owner removido deixa de ser tratado como owner', () => {
    const membership = Membership.create({
      organizationId: 'org-1',
      userId: 'user-1',
      roleId: owner.id,
    });

    membership.remove();

    expect(membership.status).toBe(MembershipStatus.REMOVED);
    expect(membership.isActive()).toBe(false);
  });

  it('remover duas vezes é idempotente', () => {
    const membership = Membership.create({
      organizationId: 'org-1',
      userId: 'user-1',
      roleId: member.id,
    });
    membership.remove();
    const removedAt = membership.updatedAt;

    membership.remove(new Date(removedAt.getTime() + 1000));

    expect(membership.updatedAt).toEqual(removedAt);
  });

  describe('reactivate', () => {
    it('volta de REMOVED para ACTIVE com o papel informado', () => {
      const joinedAt = new Date('2026-01-01T00:00:00Z');
      const membership = Membership.create(
        {
          organizationId: 'org-1',
          userId: 'user-1',
          roleId: member.id,
        },
        joinedAt,
      );
      membership.remove(new Date('2026-01-02T00:00:00Z'));
      const now = new Date('2026-01-03T00:00:00Z');

      membership.reactivate(owner.id, now);

      expect(membership.status).toBe(MembershipStatus.ACTIVE);
      expect(membership.roleId).toBe(owner.id);
      expect(membership.isActive()).toBe(true);
      expect(membership.updatedAt).toEqual(now);
      expect(membership.createdAt).toEqual(joinedAt);
    });

    it('recusa reativar um membership ativo, sem mudar o papel', () => {
      const membership = Membership.create({
        organizationId: 'org-1',
        userId: 'user-1',
        roleId: member.id,
      });

      expect(() => membership.reactivate(owner.id, new Date())).toThrow(
        InvalidMembershipError,
      );
      expect(membership.roleId).toBe(member.id);
    });
  });

  describe('changeRole', () => {
    const joinedAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-03T00:00:00Z');
    const join = () =>
      Membership.create(
        { organizationId: 'org-1', userId: 'user-1', roleId: member.id },
        joinedAt,
      );

    it('troca o papel de um membership ativo', () => {
      const membership = join();

      membership.changeRole(owner.id, now);

      expect(membership.roleId).toBe(owner.id);
      expect(membership.updatedAt).toEqual(now);
      expect(membership.isActive()).toBe(true);
    });

    it('o mesmo papel não muda nada', () => {
      const membership = join();

      membership.changeRole(member.id, now);

      expect(membership.roleId).toBe(member.id);
      expect(membership.updatedAt).toEqual(joinedAt);
    });

    it('recusa membership removido e papel vazio', () => {
      const removed = join();
      removed.remove(now);
      const active = join();

      expect(() => removed.changeRole(owner.id, now)).toThrow(
        InvalidMembershipError,
      );
      expect(() => active.changeRole(' ', now)).toThrow(InvalidMembershipError);
      expect([removed.roleId, active.roleId]).toEqual([member.id, member.id]);
    });
  });
});
