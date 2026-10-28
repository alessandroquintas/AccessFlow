import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedMachine } from '@/modules/identity/application/ports/machine-token-verifier.port';
import { MachineAuthGuard } from '@/modules/identity/presentation/auth/guards/machine-auth.guard';
import { RequireScopes } from '@/modules/identity/presentation/auth/decorators/require-scopes.decorator';
import { CurrentMachine } from '@/modules/identity/presentation/auth/decorators/current-machine.decorator';
import { MachineScope } from '@/modules/identity/presentation/auth/machine-scope';
import { AuthorizeForIntegrationUseCase } from '@/modules/organizations/application/use-cases/authorize-for-integration.use-case';
import { ApiErrorResponse } from '@/shared/presentation/http/api-error.response';
import { MACHINE_TOKEN_SECURITY } from '@/shared/presentation/http/swagger';
import { AuthorizeRequest } from '../dto/authorize.request';
import { AuthorizeResponse } from '../dto/authorize.response';

const ORGANIZATION_ID = '6f1c2a3e-0000-4000-8000-000000000001';
const USER_ID = '6f1c2a3e-0000-4000-8000-000000000002';

function example(results: [string, boolean][]) {
  return {
    organizationId: ORGANIZATION_ID,
    userId: USER_ID,
    allowed: results.every(([, allowed]) => allowed),
    results: results.map(([permission, allowed]) => ({ permission, allowed })),
  };
}

@ApiTags('Integrações — Autorização')
@ApiBearerAuth(MACHINE_TOKEN_SECURITY)
@Controller('v1')
@UseGuards(MachineAuthGuard)
export class IntegrationAuthorizationController {
  constructor(
    private readonly authorizeForIntegrationUseCase: AuthorizeForIntegrationUseCase,
  ) {}

  @Post('authorize')
  @HttpCode(HttpStatus.OK)
  @RequireScopes(MachineScope.AUTHORIZE)
  @ApiOperation({
    summary: 'Pergunta se um usuário pode executar ações na organização',
    description:
      `Exige um token de máquina com o escopo \`${MachineScope.AUTHORIZE}\`. ` +
      'O client só enxerga a organização à qual está vinculado: qualquer ' +
      'outra, mesmo existente, responde 404. Quem não é membro ativo (ou tem ' +
      'a conta desativada) recebe 200 com tudo false, igual a um membro sem ' +
      'as permissões. Toda resposta 200 é registrada (client, usuário, chaves ' +
      'pedidas e resultado) e pode ser lida pela query GraphQL ' +
      '`authorizationDecisions`. Falha fechada: se o registro não puder ser ' +
      'gravado, a resposta é 500, nunca uma decisão sem registro.',
  })
  @ApiBody({
    type: AuthorizeRequest,
    examples: {
      pedido: {
        summary: 'Uma permissão personalizada e uma de sistema',
        value: {
          organizationId: ORGANIZATION_ID,
          userId: USER_ID,
          permissions: ['invoices:approve', 'members:read'],
        },
      },
    },
  })
  @ApiOkResponse({
    type: AuthorizeResponse,
    description: 'Decisão por chave. `allowed` só é true se todas forem.',
    examples: {
      tudoPermitido: {
        summary: 'Tudo permitido',
        value: example([
          ['invoices:approve', true],
          ['members:read', true],
        ]),
      },
      parcial: {
        summary: 'Parcial: o papel não tem uma das chaves',
        value: example([
          ['invoices:approve', false],
          ['members:read', true],
        ]),
      },
      naoMembro: {
        summary: 'Não membro, membro removido ou conta desativada',
        value: example([
          ['invoices:approve', false],
          ['members:read', false],
        ]),
      },
    },
  })
  @ApiBadRequestResponse({
    type: ApiErrorResponse,
    description:
      'Corpo que não é JSON válido (`INVALID_JSON`) ou fora do formato ' +
      '(`INVALID_AUTHORIZATION_REQUEST`: ids que não são UUID, lista vazia ou ' +
      'com mais de 25 itens; `INVALID_PERMISSION_KEY`: chave fora do formato ' +
      'recurso:ação).',
    examples: {
      jsonInvalido: {
        summary: 'Corpo que não é JSON válido',
        value: {
          error: {
            code: 'BAD_REQUEST',
            reason: 'INVALID_JSON',
            message: 'O corpo da requisição não é um JSON válido.',
          },
        },
      },
      chaveForaDoFormato: {
        summary: 'Chave fora do formato recurso:ação',
        value: {
          error: {
            code: 'BAD_REQUEST',
            reason: 'INVALID_PERMISSION_KEY',
            message: 'Chave fora do formato recurso:ação: "Invoices:Approve".',
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    type: ApiErrorResponse,
    description:
      'Token ausente, malformado, expirado ou que não é de máquina (ex.: token de usuário).',
  })
  @ApiForbiddenResponse({
    type: ApiErrorResponse,
    description: `O token não tem o escopo \`${MachineScope.AUTHORIZE}\`.`,
  })
  @ApiNotFoundResponse({
    type: ApiErrorResponse,
    description:
      'Organização fora do vínculo do client (outro tenant, inexistente ou inativa).',
  })
  @ApiInternalServerErrorResponse({
    type: ApiErrorResponse,
    description:
      'Erro inesperado, inclusive falha ao registrar a decisão: sem registro, ' +
      'não há decisão (falha fechada). Os detalhes ficam só no log do ' +
      'servidor, achados pelo `requestId` do corpo.',
  })
  async authorize(
    @CurrentMachine() machine: AuthenticatedMachine,
    @Body() body: unknown,
  ): Promise<AuthorizeResponse> {
    const request = AuthorizeRequest.parse(body);

    const result = await this.authorizeForIntegrationUseCase.execute({
      clientId: machine.clientId,
      organizationId: request.organizationId,
      userId: request.userId,
      permissions: request.permissions,
    });

    return AuthorizeResponse.from(result);
  }
}
