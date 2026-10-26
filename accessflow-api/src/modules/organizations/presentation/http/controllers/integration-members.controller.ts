import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { AuthenticatedMachine } from '@/modules/identity/application/ports/machine-token-verifier.port';
import { MachineAuthGuard } from '@/modules/identity/presentation/auth/guards/machine-auth.guard';
import { RequireScopes } from '@/modules/identity/presentation/auth/decorators/require-scopes.decorator';
import { CurrentMachine } from '@/modules/identity/presentation/auth/decorators/current-machine.decorator';
import { MachineScope } from '@/modules/identity/presentation/auth/machine-scope';
import { CheckMembershipForIntegrationUseCase } from '@/modules/organizations/application/use-cases/check-membership-for-integration.use-case';

@Controller('v1/organizations')
@UseGuards(MachineAuthGuard)
export class IntegrationMembersController {
  constructor(
    private readonly checkMembershipForIntegrationUseCase: CheckMembershipForIntegrationUseCase,
  ) {}

  /** Responde se o usuário é membro ativo da organização do client. */
  @Get(':organizationId/members/:userId')
  @RequireScopes(MachineScope.MEMBERS_READ)
  async getMember(
    @CurrentMachine() machine: AuthenticatedMachine,
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
  ) {
    const membership = await this.checkMembershipForIntegrationUseCase.execute({
      clientId: machine.clientId,
      organizationId,
      userId,
    });

    return {
      organizationId: membership.organizationId,
      userId: membership.userId,
      role: membership.role,
      joinedAt: membership.joinedAt.toISOString(),
    };
  }
}
