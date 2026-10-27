import type { PrismaClient } from '@prisma/client';
import {
  Role,
  RoleSystemKey,
} from '@/modules/organizations/domain/entities/role.entity';
import { PrismaRoleMapper } from '@/modules/organizations/infrastructure/persistence/mappers/prisma-role.mapper';

export interface SeedMembershipInput {
  userId: string;
  role?: RoleSystemKey;
  status?: 'ACTIVE' | 'REMOVED';
  createdAt?: Date;
}

export interface SeededOrganization {
  id: string;
  /** Ids dos papéis de sistema da organização. */
  roleIds: Record<RoleSystemKey, string>;
}

/**
 * Cria direto no banco a organização com os papéis padrão (os mesmos do
 * createOrganization) e os memberships informados: `owner` vira OWNER e
 * `members` são MEMBER, salvo outro `role`.
 */
export async function seedOrganization(
  prisma: PrismaClient,
  input: {
    slug: string;
    name?: string;
    owner?: string;
    members?: SeedMembershipInput[];
  },
): Promise<SeededOrganization> {
  const organization = await prisma.organization.create({
    data: { name: input.name ?? input.slug, slug: input.slug },
  });

  const { owner, member } = Role.createDefaults(organization.id, new Date());
  for (const role of [owner, member]) {
    await prisma.role.create({
      data: {
        ...PrismaRoleMapper.toPersistence(role),
        permissions: {
          create: role.permissions.map((permissionKey) => ({ permissionKey })),
        },
      },
    });
  }

  const memberships: SeedMembershipInput[] = [
    ...(input.owner
      ? [{ userId: input.owner, role: RoleSystemKey.OWNER }]
      : []),
    ...(input.members ?? []),
  ];
  for (const membership of memberships) {
    await seedMembership(prisma, {
      organizationId: organization.id,
      ...membership,
    });
  }

  return {
    id: organization.id,
    roleIds: { OWNER: owner.id, MEMBER: member.id },
  };
}

/** Id do papel de sistema de uma organização já criada. */
export async function systemRoleId(
  prisma: PrismaClient,
  organizationId: string,
  systemKey: RoleSystemKey,
): Promise<string> {
  const role = await prisma.role.findFirstOrThrow({
    where: { organizationId, systemKey },
  });
  return role.id;
}

/** Membership com o papel de sistema da própria organização (MEMBER por padrão). */
export async function seedMembership(
  prisma: PrismaClient,
  {
    organizationId,
    userId,
    role = RoleSystemKey.MEMBER,
    status,
    createdAt,
  }: SeedMembershipInput & { organizationId: string },
) {
  return prisma.membership.create({
    data: {
      organizationId,
      userId,
      roleId: await systemRoleId(prisma, organizationId, role),
      status,
      createdAt,
    },
  });
}
