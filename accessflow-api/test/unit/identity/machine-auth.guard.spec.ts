import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { MachineAuthGuard } from '@/modules/identity/presentation/auth/guards/machine-auth.guard';
import { RequireScopes } from '@/modules/identity/presentation/auth/decorators/require-scopes.decorator';
import { MachineScope } from '@/modules/identity/presentation/auth/machine-scope';
import type { AuthenticatedRequest } from '@/modules/identity/presentation/auth/authenticated-request';
import { InvalidAccessTokenError } from '@/modules/identity/application/errors/invalid-access-token.error';
import { InsufficientScopeError } from '@/modules/identity/application/errors/insufficient-scope.error';
import { FakeMachineTokenVerifier } from '@test/fakes/identity/fake-machine-token-verifier';

class FakeController {
  @RequireScopes(MachineScope.MEMBERS_READ)
  protegida() {}

  semEscopos() {}
}

let machines: FakeMachineTokenVerifier;
let sut: MachineAuthGuard;

function contextFor(handler: keyof FakeController, authorization?: string) {
  const req = { headers: { authorization } } as AuthenticatedRequest;
  const context = new ExecutionContextHost(
    [req, {}, () => undefined],
    FakeController,
    FakeController.prototype[handler],
  );
  context.setType('http');
  return { context, req };
}

describe('MachineAuthGuard', () => {
  beforeEach(() => {
    machines = new FakeMachineTokenVerifier();
    machines.register('token-com-escopo', {
      clientId: 'client-integracao',
      scopes: [MachineScope.MEMBERS_READ],
    });
    machines.register('token-sem-escopo', {
      clientId: 'client-integracao',
      scopes: [],
    });
    sut = new MachineAuthGuard(machines, new Reflector());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('libera token com o escopo exigido e guarda a máquina na requisição', async () => {
    const { context, req } = contextFor('protegida', 'Bearer token-com-escopo');

    await expect(sut.canActivate(context)).resolves.toBe(true);
    expect(req.machine).toEqual({
      clientId: 'client-integracao',
      scopes: [MachineScope.MEMBERS_READ],
    });
  });

  it('recusa requisição sem header Authorization', async () => {
    const { context } = contextFor('protegida');

    await expect(sut.canActivate(context)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it.each([
    ['esquema diferente de Bearer', 'Token token-com-escopo'],
    ['Bearer sem token', 'Bearer'],
    ['token com partes extras', 'Bearer token-com-escopo extra'],
  ])('recusa header malformado: %s', async (_cenario, header) => {
    const { context } = contextFor('protegida', header);

    await expect(sut.canActivate(context)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('recusa token que o verificador não aceita', async () => {
    const { context } = contextFor('protegida', 'Bearer token-desconhecido');

    await expect(sut.canActivate(context)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('recusa token sem o escopo exigido; a negação leva o client e os escopos exigidos', async () => {
    const { context, req } = contextFor('protegida', 'Bearer token-sem-escopo');

    const error = await sut.canActivate(context).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InsufficientScopeError);
    expect((error as InsufficientScopeError).securityDenial).toEqual({
      event: 'machine.scope_denied',
      clientId: 'client-integracao',
      requiredScopes: [MachineScope.MEMBERS_READ],
    });
    expect(req.machine).toBeUndefined();
  });

  it('falha fechado em rota sem @RequireScopes', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { context } = contextFor('semEscopos', 'Bearer token-com-escopo');

    const error = await sut.canActivate(context).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InsufficientScopeError);
    expect((error as InsufficientScopeError).securityDenial).toEqual({
      event: 'machine.scope_denied',
      clientId: 'client-integracao',
      requiredScopes: [],
    });
    expect(warn).toHaveBeenCalled();
  });
});
