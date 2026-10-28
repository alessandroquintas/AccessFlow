import { ClockPort } from '@/shared/application/ports/clock.port';
import {
  DenialOrigin,
  SecurityDenialRecorder,
} from '@/shared/application/ports/security-denial-recorder.port';
import { SecurityDenial } from '@/shared/domain/security-denial';
import {
  SecurityActor,
  SecurityActorType,
  SecurityEvent,
  SecurityEventType,
} from '../../domain/entities/security-event.entity';
import { IntegrationClientRepository } from '../../domain/repositories/integration-client.repository';
import { SecurityEventLog } from '../../domain/repositories/security-event-log.repository';
import { UserDirectoryPort } from '../ports/user-directory.port';

/**
 * Transforma a negação em evento de segurança e o grava.
 *
 * - Usuário: o ator é o usuário autenticado da requisição, e a organização é
 *   a da negação. O detalhe leva a operação GraphQL.
 * - Máquina: o ator é o client do token, e a organização é a do cadastro
 *   dele (nula se não estiver cadastrado), nunca a pedida. Assim uma
 *   organização só recebe eventos de quem é dela: um client de fora não
 *   escreve na tabela de outra organização, pelo mesmo motivo que o não
 *   membro não vira evento. O detalhe leva a rota.
 */
export class SecurityEventRecorder extends SecurityDenialRecorder {
  constructor(
    private readonly securityEvents: SecurityEventLog,
    private readonly users: UserDirectoryPort,
    private readonly integrationClients: IntegrationClientRepository,
    private readonly clock: ClockPort,
  ) {
    super();
  }

  async record(denial: SecurityDenial, origin: DenialOrigin): Promise<void> {
    await this.securityEvents.record(await this.toEvent(denial, origin));
  }

  private async toEvent(
    denial: SecurityDenial,
    origin: DenialOrigin,
  ): Promise<SecurityEvent> {
    switch (denial.event) {
      case SecurityEventType.ACCESS_FORBIDDEN:
        return SecurityEvent.create(
          {
            organizationId: denial.organizationId,
            actor: await this.userActor(origin),
            event: denial.event,
            details: {
              operation: required(origin.operation, 'operation'),
              permission: denial.permission,
            },
          },
          this.clock.now(),
        );
      case SecurityEventType.ACCESS_PRIVILEGE_ESCALATION:
        return SecurityEvent.create(
          {
            organizationId: denial.organizationId,
            actor: await this.userActor(origin),
            event: denial.event,
            details: { operation: required(origin.operation, 'operation') },
          },
          this.clock.now(),
        );
      case SecurityEventType.MACHINE_SCOPE_DENIED:
        return SecurityEvent.create(
          {
            organizationId: await this.organizationOfClient(denial.clientId),
            actor: {
              type: SecurityActorType.MACHINE,
              clientId: denial.clientId,
            },
            event: denial.event,
            details: {
              route: required(origin.route, 'route'),
              requiredScopes: [...denial.requiredScopes],
            },
          },
          this.clock.now(),
        );
      case SecurityEventType.MACHINE_ORGANIZATION_DENIED:
        return SecurityEvent.create(
          {
            organizationId: await this.organizationOfClient(denial.clientId),
            actor: {
              type: SecurityActorType.MACHINE,
              clientId: denial.clientId,
            },
            event: denial.event,
            details: { route: required(origin.route, 'route') },
          },
          this.clock.now(),
        );
    }
  }

  private async userActor(origin: DenialOrigin): Promise<SecurityActor> {
    const sub = required(origin.userSub, 'userSub');
    return {
      type: SecurityActorType.USER,
      userId: await this.users.getActiveUserId(sub),
    };
  }

  /** A do cadastro, mesmo revogado: quem o revogou quer saber que ele insiste. */
  private async organizationOfClient(clientId: string): Promise<string | null> {
    const client = await this.integrationClients.findByClientId(clientId);
    return client?.organizationId ?? null;
  }
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Negação sem ${name} na origem.`);
  return value;
}
