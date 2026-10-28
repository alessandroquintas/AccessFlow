import { Injectable } from '@nestjs/common';
import type { RoleSystemKey as PrismaRoleSystemKey } from '@prisma/client';
import { PrismaClientProvider } from '@/shared/infrastructure/database/prisma-client.provider';
import {
  AuthorizationSnapshot,
  AuthorizationSnapshotPort,
} from '@/modules/organizations/application/ports/authorization-snapshot.port';
import { PrismaRoleMapper } from './mappers/prisma-role.mapper';

/** O papel como o json_build_object devolve: datas em texto. */
interface RoleJson {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  systemKey: PrismaRoleSystemKey | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: string[];
}

interface SnapshotRow {
  membership: { role: RoleJson | null } | null;
  customKeys: string[];
}

@Injectable()
export class PrismaAuthorizationSnapshotReader extends AuthorizationSnapshotPort {
  constructor(private readonly clients: PrismaClientProvider) {
    super();
  }

  async load(
    organizationId: string,
    userId: string,
    keys: readonly string[],
  ): Promise<AuthorizationSnapshot> {
    // Uma consulta só: no READ COMMITTED cada comando vê um snapshot, então
    // membership, papel, permissões e catálogo saem do mesmo instante, sem
    // trava e sem transação.
    const [row] = await this.clients.current().$queryRaw<SnapshotRow[]>`
      SELECT
        (
          SELECT json_build_object(
            'role',
            CASE WHEN r.id IS NULL THEN NULL ELSE json_build_object(
              'id', r.id,
              'organizationId', r.organization_id,
              'name', r.name,
              'description', r.description,
              'systemKey', r.system_key,
              'deletedAt', r.deleted_at,
              'createdAt', r.created_at,
              'updatedAt', r.updated_at,
              'permissions', ARRAY(
                SELECT rp.permission_key
                FROM role_permissions rp
                WHERE rp.role_id = r.id
              )
            ) END
          )
          FROM memberships m
          LEFT JOIN roles r ON r.id = m.role_id
          WHERE m.organization_id = ${organizationId}::uuid
            AND m.user_id = ${userId}::uuid
            AND m.status = 'ACTIVE'
        ) AS "membership",
        ARRAY(
          SELECT op.key
          FROM organization_permissions op
          WHERE op.organization_id = ${organizationId}::uuid
            AND op.key = ANY(${[...keys]}::text[])
        ) AS "customKeys"`;

    const role = row.membership?.role;
    return {
      membership: row.membership && {
        role: role
          ? PrismaRoleMapper.toDomain({
              ...role,
              deletedAt: role.deletedAt ? new Date(role.deletedAt) : null,
              createdAt: new Date(role.createdAt),
              updatedAt: new Date(role.updatedAt),
              permissions: role.permissions.map((permissionKey) => ({
                permissionKey,
              })),
            })
          : null,
      },
      customKeys: row.customKeys,
    };
  }
}
