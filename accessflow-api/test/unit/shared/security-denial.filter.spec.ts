import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpServer, Logger } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { GraphQLError } from 'graphql';
import { DomainErrorFilter } from '@/shared/presentation/domain-error.filter';
import { SecurityDenialFilter } from '@/shared/presentation/security-denial.filter';
import {
  DenialOrigin,
  SecurityDenialRecorder,
} from '@/shared/application/ports/security-denial-recorder.port';
import { RequestContextPort } from '@/shared/application/ports/request-context.port';
import type { SecurityDenial } from '@/shared/domain/security-denial';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { OrganizationPermissionDeniedError } from '@/modules/organizations/domain/errors/organization-permission-denied.error';
import { InsufficientScopeError } from '@/modules/identity/application/errors/insufficient-scope.error';

const REQUEST_ID = 'req-unit-0002';
const ROUTE_PATH = '/v1/organizations/:organizationId/members/:userId';

class StubRequestContext extends RequestContextPort {
  requestId(): string | undefined {
    return REQUEST_ID;
  }
}

/** Guarda as chamadas; `hold` segura a gravação até `release`. */
class FakeRecorder extends SecurityDenialRecorder {
  calls: { denial: SecurityDenial; origin: DenialOrigin }[] = [];
  failure: Error | null = null;
  private held: Promise<void> | null = null;
  release: () => void = () => undefined;

  hold(): void {
    this.held = new Promise((resolve) => (this.release = resolve));
  }

  async record(denial: SecurityDenial, origin: DenialOrigin): Promise<void> {
    this.calls.push({ denial, origin });
    await this.held;
    if (this.failure) throw this.failure;
  }
}

const response = { tipo: 'resposta-http' };
let adapter: {
  reply: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
};
let recorder: FakeRecorder;
let logError: ReturnType<typeof vi.spyOn>;
let sut: SecurityDenialFilter;

function httpHost(request: Record<string, unknown>) {
  const host = new ExecutionContextHost([request, response, () => undefined]);
  host.setType('http');
  return host;
}

function graphqlHost(fieldName: string, sub?: string) {
  const req = sub ? { identity: { sub } } : {};
  const host = new ExecutionContextHost([{}, {}, { req }, { fieldName }]);
  host.setType('graphql');
  return host;
}

const forbidden = () =>
  new OrganizationPermissionDeniedError({
    organizationId: '11111111-1111-4111-8111-111111111111',
    permission: 'roles:manage',
  });
const scopeDenied = () =>
  new InsufficientScopeError({
    clientId: 'client-erp',
    requiredScopes: ['accessflow-api/members.read'],
  });
const memberRequest = {
  method: 'GET',
  path: '/v1/organizations/abc/members/def',
  route: { path: ROUTE_PATH },
  headers: {},
};

describe('SecurityDenialFilter', () => {
  beforeEach(() => {
    adapter = { reply: vi.fn(), setHeader: vi.fn() };
    logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    recorder = new FakeRecorder();
    const requestContext = new StubRequestContext();
    sut = new SecurityDenialFilter(
      new DomainErrorFilter(requestContext, adapter as unknown as HttpServer),
      recorder,
      requestContext,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('erro que não é negação', () => {
    it('GraphQL: responde na hora como o DomainErrorFilter, sem gravar', () => {
      const result = sut.catch(
        new OrganizationNotFoundError(),
        graphqlHost('organization'),
      );

      expect(result).toBeInstanceOf(GraphQLError);
      expect((result as GraphQLError).extensions).toEqual({
        code: 'NOT_FOUND',
        reason: 'ORGANIZATION_NOT_FOUND',
      });
      expect(recorder.calls).toEqual([]);
    });

    it('HTTP: responde na hora, sem gravar', () => {
      const result = sut.catch(
        new OrganizationNotFoundError(),
        httpHost(memberRequest),
      );

      // Sem promessa: a resposta saiu antes do catch voltar.
      expect(result).toBeUndefined();
      expect(adapter.reply).toHaveBeenCalledWith(
        response,
        expect.objectContaining({
          error: expect.objectContaining({ reason: 'ORGANIZATION_NOT_FOUND' }),
        }),
        404,
      );
      expect(recorder.calls).toEqual([]);
    });
  });

  describe('negação', () => {
    it('GraphQL: grava com a operação e o usuário, e devolve o mesmo FORBIDDEN', async () => {
      const result = await sut.catch(
        forbidden(),
        graphqlHost('createRole', 'sub-ana'),
      );

      expect(recorder.calls).toEqual([
        {
          denial: {
            event: 'access.forbidden',
            organizationId: '11111111-1111-4111-8111-111111111111',
            permission: 'roles:manage',
          },
          origin: { operation: 'createRole', userSub: 'sub-ana' },
        },
      ]);
      expect((result as GraphQLError).extensions).toEqual({
        code: 'FORBIDDEN',
        reason: 'ORGANIZATION_PERMISSION_DENIED',
      });
    });

    it('HTTP: grava com a rota declarada, sem os ids pedidos, e só então responde 403', async () => {
      recorder.hold();

      const done = sut.catch(scopeDenied(), httpHost(memberRequest));
      await Promise.resolve();
      expect(recorder.calls).toHaveLength(1);
      expect(adapter.reply).not.toHaveBeenCalled();

      recorder.release();
      await done;

      expect(recorder.calls[0].origin).toEqual({
        route: `GET ${ROUTE_PATH}`,
        userSub: undefined,
      });
      expect(adapter.reply).toHaveBeenCalledWith(
        response,
        {
          error: {
            code: 'FORBIDDEN',
            reason: 'INSUFFICIENT_SCOPE',
            message: 'O token não tem permissão para esta operação.',
          },
        },
        403,
      );
    });

    it('HTTP sem rota casada: usa o caminho pedido', async () => {
      await sut.catch(
        scopeDenied(),
        httpHost({ method: 'POST', path: '/v1/authorize', headers: {} }),
      );

      expect(recorder.calls[0].origin.route).toBe('POST /v1/authorize');
    });

    it('falha ao gravar: a resposta é a mesma, e o log leva o evento e o requestId', async () => {
      const failure = new Error('banco fora');
      recorder.failure = failure;

      await sut.catch(scopeDenied(), httpHost(memberRequest));
      const result = await sut.catch(
        forbidden(),
        graphqlHost('createRole', 'sub-ana'),
      );

      expect(adapter.reply).toHaveBeenCalledWith(
        response,
        expect.anything(),
        403,
      );
      expect((result as GraphQLError).extensions?.code).toBe('FORBIDDEN');
      expect(logError).toHaveBeenCalledWith(
        `Evento machine.scope_denied não gravado; requestId=${REQUEST_ID}`,
        failure,
      );
      expect(logError).toHaveBeenCalledWith(
        `Evento access.forbidden não gravado; requestId=${REQUEST_ID}`,
        failure,
      );
    });
  });
});
