import { InsufficientScopeError } from '@/modules/identity/application/errors/insufficient-scope.error';
import { InvalidAccessTokenError } from '@/modules/identity/application/errors/invalid-access-token.error';
import { MachineTokenVerifierPort } from '@/modules/identity/application/ports/machine-token-verifier.port';
import { getRequest } from '@/shared/presentation/get-request';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../authenticated-request';
import { extractBearerToken } from '../bearer-token';
import { REQUIRED_SCOPES_KEY } from '../decorators/require-scopes.decorator';
import type { MachineScope } from '@/shared/domain/machine-scope';

@Injectable()
export class MachineAuthGuard implements CanActivate {
  private readonly logger = new Logger(MachineAuthGuard.name);

  constructor(
    private readonly machineTokenVerifier: MachineTokenVerifierPort,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequest<AuthenticatedRequest>(context);

    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new InvalidAccessTokenError();

    const machine = await this.machineTokenVerifier.verify(token);

    const required = this.reflector.getAllAndOverride<
      MachineScope[] | undefined
    >(REQUIRED_SCOPES_KEY, [context.getHandler(), context.getClass()]);

    // Falha fechada: rota protegida sem escopos declarados é recusada.
    if (!required?.length) {
      this.logger.warn(
        `Rota ${context.getClass().name}.${context.getHandler().name} usa MachineAuthGuard sem @RequireScopes: acesso negado.`,
      );
      throw new InsufficientScopeError({
        clientId: machine.clientId,
        requiredScopes: [],
      });
    }

    if (!required.every((scope) => machine.scopes.includes(scope))) {
      throw new InsufficientScopeError({
        clientId: machine.clientId,
        requiredScopes: required,
      });
    }

    request.machine = machine;
    return true;
  }
}
