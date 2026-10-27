import { describe, expect, it } from 'vitest';
import {
  Role,
  RoleSystemKey,
} from '@/modules/organizations/domain/entities/role.entity';
import { InvalidRoleError } from '@/modules/organizations/domain/errors/invalid-role.error';
import { OrganizationPermission } from '@/modules/organizations/policies/organization-permission';

const NOW = new Date('2026-03-01T12:00:00.000Z');

describe('Role', () => {
  const { owner, member } = Role.createDefaults('org-1', NOW);

  describe('createDefaults', () => {
    it('cria o OWNER e o MEMBER de sistema da organização', () => {
      expect([owner, member].map((role) => role.organizationId)).toEqual([
        'org-1',
        'org-1',
      ]);
      expect(owner).toMatchObject({
        name: 'Owner',
        systemKey: RoleSystemKey.OWNER,
        permissions: [],
        description: null,
        deletedAt: null,
        createdAt: NOW,
      });
      expect(member).toMatchObject({
        name: 'Member',
        systemKey: RoleSystemKey.MEMBER,
        permissions: [OrganizationPermission.MEMBERS_READ],
      });
      expect(owner.id).not.toBe(member.id);
    });

    it('os dois são de sistema, só o OWNER é OWNER e nenhum está apagado', () => {
      expect([owner.isSystem(), member.isSystem()]).toEqual([true, true]);
      expect([owner.isOwner(), member.isOwner()]).toEqual([true, false]);
      expect([owner.isDeleted(), member.isDeleted()]).toEqual([false, false]);
    });
  });

  describe('grants', () => {
    it('OWNER tem até permissão que não existe no catálogo', () => {
      expect(owner.grants('permissao:inexistente')).toBe(true);
      for (const permission of Object.values(OrganizationPermission)) {
        expect(owner.grants(permission)).toBe(true);
      }
    });

    it('MEMBER tem só members:read', () => {
      const granted = Object.values(OrganizationPermission).filter(
        (permission) => member.grants(permission),
      );

      expect(granted).toEqual([OrganizationPermission.MEMBERS_READ]);
      expect(member.grants('permissao:inexistente')).toBe(false);
    });

    it('papel customizado tem só as permissões gravadas', () => {
      const custom = Role.restore({
        id: 'role-financeiro',
        organizationId: 'org-1',
        name: 'Financeiro',
        description: null,
        systemKey: null,
        permissions: [OrganizationPermission.MEMBERS_INVITE],
        deletedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      });

      expect(custom.isSystem()).toBe(false);
      expect(custom.grants(OrganizationPermission.MEMBERS_INVITE)).toBe(true);
      expect(custom.grants(OrganizationPermission.MEMBERS_READ)).toBe(false);
    });
  });

  it.each(['id', 'organizationId', 'name'] as const)(
    'restore exige %s',
    (field) => {
      expect(() =>
        Role.restore({
          id: member.id,
          organizationId: member.organizationId,
          name: member.name,
          description: member.description,
          systemKey: member.systemKey,
          permissions: member.permissions,
          deletedAt: member.deletedAt,
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
          [field]: ' ',
        }),
      ).toThrow(InvalidRoleError);
    },
  );
});
