import { ClockPort } from '@/shared/application/ports/clock.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { CustomPermission } from '../../domain/entities/custom-permission.entity';
import { PermissionKeyTakenError } from '../../domain/errors/permission-key-taken.error';
import { PermissionLimitReachedError } from '../../domain/errors/permission-limit-reached.error';
import { CustomPermissionRepository } from '../../domain/repositories/custom-permission.repository';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { OrganizationPermission } from '../../policies/organization-permission';
import { OrganizationPermissionEntry } from '../dto/organization-permission-entry';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { OrganizationAccessService } from '../services/organization-access.service';
import {
  AuditAction,
  AuditEvent,
  userActor,
} from '../../domain/entities/audit-event.entity';
import { AuditLog } from '../../domain/repositories/audit-log.repository';

export interface CreatePermissionInput {
  cognitoSub: string;
  organizationId: string;
  key: string;
  description: string;
}

export class CreatePermissionUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly customPermissions: CustomPermissionRepository,
    private readonly users: UserDirectoryPort,
    private readonly access: OrganizationAccessService,
    private readonly audit: AuditLog,
    private readonly transactions: TransactionManager,
    private readonly clock: ClockPort,
  ) {}

  /** Não concede a permissão a ninguém: só o OWNER a tem, implicitamente. */
  async execute(
    input: CreatePermissionInput,
  ): Promise<OrganizationPermissionEntry> {
    const actorId = await this.users.getActiveUserId(input.cognitoSub);
    const organizationId = input.organizationId.toLowerCase();

    const permission = await this.transactions.run(async () => {
      // Trava antes de checar: a permissão do autor, a chave livre e o limite
      // valem até o commit. A unique do banco fica como segunda linha.
      await this.organizations.lock(organizationId);
      await this.access.requirePermission(
        organizationId,
        actorId,
        OrganizationPermission.PERMISSIONS_MANAGE,
      );

      const now = this.clock.now();
      const permission = CustomPermission.create(
        { organizationId, key: input.key, description: input.description },
        now,
      );

      const existing =
        await this.customPermissions.listByOrganization(organizationId);
      if (existing.some((p) => p.key === permission.key)) {
        throw new PermissionKeyTakenError();
      }
      if (existing.length >= CustomPermission.MAX_PER_ORGANIZATION) {
        throw new PermissionLimitReachedError();
      }

      await this.customPermissions.create(permission);
      await this.audit.record(
        AuditEvent.create(
          {
            organizationId,
            actor: userActor(actorId),
            action: AuditAction.PERMISSION_CREATED,
            targetId: permission.key,
            details: {
              key: permission.key,
              description: permission.description,
            },
          },
          now,
        ),
      );
      return permission;
    });

    return {
      key: permission.key,
      description: permission.description,
      isSystem: false,
    };
  }
}
