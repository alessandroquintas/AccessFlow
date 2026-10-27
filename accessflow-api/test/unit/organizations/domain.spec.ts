import { describe, expect, it } from 'vitest';
import { Slug } from '@/modules/organizations/domain/value-objects/slug.vo';
import { Organization } from '@/modules/organizations/domain/entities/organization.entity';
import {
  Membership,
  MembershipRole,
  MembershipStatus,
} from '@/modules/organizations/domain/entities/membership.entity';
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
  it('cria o OWNER ativo', () => {
    const membership = Membership.createOwner('org-1', 'user-1');

    expect(membership.role).toBe(MembershipRole.OWNER);
    expect(membership.isActive()).toBe(true);
    expect(membership.isOwner()).toBe(true);
  });

  it('owner removido deixa de ser tratado como owner', () => {
    const membership = Membership.createOwner('org-1', 'user-1');

    membership.remove();

    expect(membership.status).toBe(MembershipStatus.REMOVED);
    expect(membership.isOwner()).toBe(false);
  });

  it('remover duas vezes é idempotente', () => {
    const membership = Membership.create({
      organizationId: 'org-1',
      userId: 'user-1',
      role: MembershipRole.MEMBER,
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
          role: MembershipRole.MEMBER,
        },
        joinedAt,
      );
      membership.remove(new Date('2026-01-02T00:00:00Z'));
      const now = new Date('2026-01-03T00:00:00Z');

      membership.reactivate(MembershipRole.OWNER, now);

      expect(membership.status).toBe(MembershipStatus.ACTIVE);
      expect(membership.role).toBe(MembershipRole.OWNER);
      expect(membership.isOwner()).toBe(true);
      expect(membership.updatedAt).toEqual(now);
      expect(membership.createdAt).toEqual(joinedAt);
    });

    it('recusa reativar um membership ativo, sem mudar o papel', () => {
      const membership = Membership.create({
        organizationId: 'org-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
      });

      expect(() =>
        membership.reactivate(MembershipRole.OWNER, new Date()),
      ).toThrow(InvalidMembershipError);
      expect(membership.role).toBe(MembershipRole.MEMBER);
    });
  });
});
