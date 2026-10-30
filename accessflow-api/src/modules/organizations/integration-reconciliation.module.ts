import { Module } from '@nestjs/common';
import { EnvModule } from '@/config/env.module';
import { ClockPort } from '@/shared/application/ports/clock.port';
import { RequestContextPort } from '@/shared/application/ports/request-context.port';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.port';
import { ClockModule } from '@/shared/infrastructure/clock/clock.module';
import { PrismaModule } from '@/shared/infrastructure/database/prisma.module';
import { NestLogger } from '@/shared/infrastructure/logging/nest-logger';
import { RequestContextModule } from '@/shared/infrastructure/request-context/request-context.module';
import { MachineClientProvisioner } from './application/ports/machine-client-provisioner.port';
import { ReconcileIntegrationClientsUseCase } from './application/use-cases/reconcile-integration-clients.use-case';
import { IntegrationClientRepository } from './domain/repositories/integration-client.repository';
import { OrganizationRepository } from './domain/repositories/organization.repository';
import { machineClientProvisionerProvider } from './infrastructure/cognito/machine-client-provisioner.provider';
import { PrismaIntegrationClientRepository } from './infrastructure/persistence/prisma-integration-client.repository';
import { PrismaOrganizationRepository } from './infrastructure/persistence/prisma-organization.repository';

/**
 * Só o necessário para a reconciliação (npm run reconcile:integrations):
 * sem HTTP nem GraphQL.
 */
@Module({
  imports: [EnvModule, PrismaModule, ClockModule, RequestContextModule],
  providers: [
    { provide: OrganizationRepository, useClass: PrismaOrganizationRepository },
    {
      provide: IntegrationClientRepository,
      useClass: PrismaIntegrationClientRepository,
    },
    machineClientProvisionerProvider,
    {
      provide: ReconcileIntegrationClientsUseCase,
      inject: [
        OrganizationRepository,
        IntegrationClientRepository,
        MachineClientProvisioner,
        TransactionManager,
        ClockPort,
        RequestContextPort,
      ],
      useFactory: (
        organizations: OrganizationRepository,
        integrationClients: IntegrationClientRepository,
        machineClients: MachineClientProvisioner,
        transactions: TransactionManager,
        clock: ClockPort,
        requestContext: RequestContextPort,
      ) =>
        new ReconcileIntegrationClientsUseCase(
          organizations,
          integrationClients,
          machineClients,
          transactions,
          clock,
          new NestLogger('ReconcileIntegrations', requestContext),
        ),
    },
  ],
})
export class IntegrationReconciliationModule {}
