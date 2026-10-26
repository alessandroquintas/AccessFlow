import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedMachine } from '@/modules/identity/application/ports/machine-token-verifier.port';
import { MachineAuthGuard } from '@/modules/identity/presentation/auth/guards/machine-auth.guard';
import { RequireScopes } from '@/modules/identity/presentation/auth/decorators/require-scopes.decorator';
import { CurrentMachine } from '@/modules/identity/presentation/auth/decorators/current-machine.decorator';
import { MachineScope } from '@/modules/identity/presentation/auth/machine-scope';
import { CheckMembershipForIntegrationUseCase } from '@/modules/organizations/application/use-cases/check-membership-for-integration.use-case';
import { ApiErrorResponse } from '@/shared/presentation/http/api-error.response';
import { MACHINE_TOKEN_SECURITY } from '@/shared/presentation/http/swagger';
import { IntegrationMemberResponse } from '../dto/integration-member.response';

@ApiTags('Integrações — Membros')
@ApiBearerAuth(MACHINE_TOKEN_SECURITY)
@Controller('v1/organizations')
@UseGuards(MachineAuthGuard)
export class IntegrationMembersController {
  constructor(
    private readonly checkMembershipForIntegrationUseCase: CheckMembershipForIntegrationUseCase,
  ) {}

  @Get(':organizationId/members/:userId')
  @RequireScopes(MachineScope.MEMBERS_READ)
  @ApiOperation({
    summary: 'Consulta se um usuário é membro ativo da organização',
    description:
      `Exige um token de máquina com o escopo \`${MachineScope.MEMBERS_READ}\`. ` +
      'O client só enxerga a organização à qual está vinculado: qualquer ' +
      'outra organização, mesmo existente, responde 404.',
  })
  @ApiParam({
    name: 'organizationId',
    format: 'uuid',
    description: 'Organização vinculada ao client de integração.',
  })
  @ApiParam({
    name: 'userId',
    format: 'uuid',
    description: 'Usuário a consultar.',
  })
  @ApiOkResponse({
    type: IntegrationMemberResponse,
    description: 'O usuário é membro ativo da organização.',
  })
  @ApiUnauthorizedResponse({
    type: ApiErrorResponse,
    description:
      'Token ausente, malformado, expirado ou que não é de máquina (ex.: token de usuário).',
  })
  @ApiForbiddenResponse({
    type: ApiErrorResponse,
    description: `O token não tem o escopo \`${MachineScope.MEMBERS_READ}\`.`,
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponse,
    description:
      'Organização fora do vínculo do client (outro tenant, inexistente ou ' +
      'inativa) ou usuário que não é membro ativo. Ids malformados também ' +
      'respondem 404.',
  })
  @ApiInternalServerErrorResponse({
    type: ApiErrorResponse,
    description: 'Erro inesperado. Os detalhes ficam só no log do servidor.',
  })
  async getMember(
    @CurrentMachine() machine: AuthenticatedMachine,
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
  ): Promise<IntegrationMemberResponse> {
    const membership = await this.checkMembershipForIntegrationUseCase.execute({
      clientId: machine.clientId,
      organizationId,
      userId,
    });

    return IntegrationMemberResponse.from(membership);
  }
}
