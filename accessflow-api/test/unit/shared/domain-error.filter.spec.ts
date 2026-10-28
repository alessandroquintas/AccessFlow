import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  HttpServer,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { GraphQLError } from 'graphql';
import { DomainErrorFilter } from '@/shared/presentation/domain-error.filter';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors/organization-not-found.error';
import { InvalidAccessTokenError } from '@/modules/identity/application/errors/invalid-access-token.error';
import { InsufficientScopeError } from '@/modules/identity/application/errors/insufficient-scope.error';
import { InvalidCursorError } from '@/shared/application/errors/invalid-cursor.error';
import { InvalidEmailError } from '@/shared/domain/errors/invalid-email.error';
import { InvitationNotFoundError } from '@/modules/organizations/domain/errors/invitation-not-found.error';
import { AlreadyMemberError } from '@/modules/organizations/domain/errors/already-member.error';
import { InvitationLimitReachedError } from '@/modules/organizations/domain/errors/invitation-limit-reached.error';
import { InvalidInvitationError } from '@/modules/organizations/domain/errors/invalid-invitation.error';
import { InvalidPermissionError } from '@/modules/organizations/domain/errors/invalid-permission.error';
import { InvalidRoleError } from '@/modules/organizations/domain/errors/invalid-role.error';
import { RoleNameTakenError } from '@/modules/organizations/domain/errors/role-name-taken.error';
import { RoleLimitReachedError } from '@/modules/organizations/domain/errors/role-limit-reached.error';
import { SystemRoleImmutableError } from '@/modules/organizations/domain/errors/system-role-immutable.error';
import { RoleInUseError } from '@/modules/organizations/domain/errors/role-in-use.error';
import { RoleNotFoundError } from '@/modules/organizations/domain/errors/role-not-found.error';
import { PrivilegeEscalationError } from '@/modules/organizations/domain/errors/privilege-escalation.error';
import { InvalidPermissionKeyError } from '@/modules/organizations/domain/errors/invalid-permission-key.error';
import { InvalidPermissionDescriptionError } from '@/modules/organizations/domain/errors/invalid-permission-description.error';
import { ReservedPermissionResourceError } from '@/modules/organizations/domain/errors/reserved-permission-resource.error';
import { InvalidCustomPermissionError } from '@/modules/organizations/domain/errors/invalid-custom-permission.error';
import { PermissionKeyTakenError } from '@/modules/organizations/domain/errors/permission-key-taken.error';
import { PermissionLimitReachedError } from '@/modules/organizations/domain/errors/permission-limit-reached.error';
import { PermissionInUseError } from '@/modules/organizations/domain/errors/permission-in-use.error';
import { PermissionNotFoundError } from '@/modules/organizations/domain/errors/permission-not-found.error';
import { InvalidAuthorizationRequestError } from '@/modules/organizations/application/errors/invalid-authorization-request.error';
import { InvalidAuditFilterError } from '@/modules/organizations/application/errors/invalid-audit-filter.error';
import { RequestContextPort } from '@/shared/application/ports/request-context.port';

const response = { tipo: 'resposta-http' };
const REQUEST_ID = 'req-unit-0001';
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** O id que o RequestIdMiddleware abriu; undefined = erro antes dele. */
let currentRequestId: string | undefined;

class StubRequestContext extends RequestContextPort {
  requestId(): string | undefined {
    return currentRequestId;
  }
}

let adapter: {
  reply: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  isHeadersSent: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
};
let logError: ReturnType<typeof vi.spyOn>;
let sut: DomainErrorFilter;

function httpHost(request: Record<string, unknown> = {}) {
  const host = new ExecutionContextHost([request, response, () => undefined]);
  host.setType('http');
  return host;
}

function graphqlHost() {
  const host = new ExecutionContextHost([{}, {}, { req: {} }, {}]);
  host.setType('graphql');
  return host;
}

describe('DomainErrorFilter', () => {
  beforeEach(() => {
    adapter = {
      reply: vi.fn(),
      setHeader: vi.fn(),
      isHeadersSent: vi.fn(() => false),
      end: vi.fn(),
    };
    logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    currentRequestId = REQUEST_ID;
    sut = new DomainErrorFilter(
      new StubRequestContext(),
      adapter as unknown as HttpServer,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GraphQL', () => {
    it.each([
      [new OrganizationNotFoundError(), 'NOT_FOUND'],
      [new InvalidAccessTokenError(), 'UNAUTHENTICATED'],
      [new InsufficientScopeError(), 'FORBIDDEN'],
      [new InvalidCursorError(), 'BAD_REQUEST'],
      [new InvitationNotFoundError(), 'NOT_FOUND'],
      [new AlreadyMemberError(), 'CONFLICT'],
      [new InvitationLimitReachedError(), 'CONFLICT'],
      [new InvalidEmailError(), 'BAD_REQUEST'],
      [new InvalidInvitationError('id é obrigatório.'), 'BAD_REQUEST'],
      [new InvalidPermissionError('x:y'), 'BAD_REQUEST'],
      [new InvalidRoleError('name é obrigatório.'), 'BAD_REQUEST'],
      [new RoleNameTakenError(), 'CONFLICT'],
      [new RoleLimitReachedError(), 'CONFLICT'],
      [new SystemRoleImmutableError('imutável'), 'CONFLICT'],
      [new RoleInUseError(), 'CONFLICT'],
      [new RoleNotFoundError(), 'NOT_FOUND'],
      [new PrivilegeEscalationError(), 'FORBIDDEN'],
      [new InvalidPermissionKeyError('formato'), 'BAD_REQUEST'],
      [new InvalidPermissionDescriptionError('vazia'), 'BAD_REQUEST'],
      [new ReservedPermissionResourceError('reservado'), 'BAD_REQUEST'],
      [new InvalidCustomPermissionError('id'), 'BAD_REQUEST'],
      [new PermissionKeyTakenError(), 'CONFLICT'],
      [new PermissionLimitReachedError(), 'CONFLICT'],
      [new PermissionInUseError(), 'CONFLICT'],
      [new PermissionNotFoundError(), 'NOT_FOUND'],
      [new InvalidAuthorizationRequestError('corpo'), 'BAD_REQUEST'],
      [new InvalidAuditFilterError('filtro'), 'BAD_REQUEST'],
    ])('traduz %s para %s', (error, code) => {
      const result = sut.catch(error, graphqlHost()) as GraphQLError;

      expect(result).toBeInstanceOf(GraphQLError);
      expect(result.message).toBe(error.message);
      expect(result.extensions).toEqual({ code, reason: error.code });
      expect(adapter.reply).not.toHaveBeenCalled();
    });

    it('registra com o requestId e repassa erros inesperados (o formatError mascara)', () => {
      const error = new Error('falha interna');

      expect(() => sut.catch(error, graphqlHost())).toThrow(error);
      expect(logError).toHaveBeenCalledWith(`requestId=${REQUEST_ID}`, error);
    });

    it('repassa HttpException sem registrar', () => {
      const error = new NotFoundException();

      expect(() => sut.catch(error, graphqlHost())).toThrow(error);
      expect(logError).not.toHaveBeenCalled();
    });
  });

  describe('HTTP', () => {
    describe('JSON inválido (BadRequestException do Nest para o SyntaxError do body-parser)', () => {
      const parserError = () =>
        new BadRequestException(
          `Unexpected token 'o', "{oops" is not valid JSON`,
        );

      function hostWith(request: Record<string, unknown>) {
        const host = new ExecutionContextHost([
          request,
          response,
          () => undefined,
        ]);
        host.setType('http');
        return host;
      }

      const jsonRequest = (overrides: Record<string, unknown> = {}) => ({
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-length': '5',
        },
        body: undefined,
        ...overrides,
      });

      it('responde 400 INVALID_JSON no formato padrão, sem o texto do parser', () => {
        sut.catch(parserError(), hostWith(jsonRequest()));

        expect(adapter.reply).toHaveBeenCalledWith(
          response,
          {
            error: {
              code: 'BAD_REQUEST',
              reason: 'INVALID_JSON',
              message: 'O corpo da requisição não é um JSON válido.',
            },
          },
          400,
        );
        expect(JSON.stringify(adapter.reply.mock.calls)).not.toContain('oops');
      });

      it('com transfer-encoding no lugar de content-length também', () => {
        sut.catch(
          parserError(),
          hostWith(
            jsonRequest({
              headers: {
                'content-type': 'application/json',
                'transfer-encoding': 'chunked',
              },
            }),
          ),
        );

        expect(adapter.reply.mock.calls[0][1]).toMatchObject({
          error: { reason: 'INVALID_JSON' },
        });
      });

      it.each([
        ['corpo lido com sucesso', jsonRequest({ body: { ok: true } })],
        [
          'Content-Type que não é JSON',
          jsonRequest({
            headers: { 'content-type': 'text/plain', 'content-length': '5' },
          }),
        ],
        [
          'sem corpo',
          jsonRequest({
            headers: {
              'content-type': 'application/json',
              'content-length': '0',
            },
          }),
        ],
      ])('%s: segue o padrão do Nest', (_, request) => {
        sut.catch(
          new BadRequestException('Failed to decode param'),
          hostWith(request),
        );

        expect(adapter.reply).toHaveBeenCalledWith(
          response,
          {
            message: 'Failed to decode param',
            error: 'Bad Request',
            statusCode: 400,
          },
          400,
        );
      });
    });

    it('responde DomainError com status e corpo padronizado', () => {
      const error = new OrganizationNotFoundError();

      sut.catch(error, httpHost());

      expect(adapter.reply).toHaveBeenCalledWith(
        response,
        {
          error: {
            code: 'NOT_FOUND',
            reason: 'ORGANIZATION_NOT_FOUND',
            message: error.message,
          },
        },
        404,
      );
      expect(adapter.setHeader).not.toHaveBeenCalled();
    });

    it('envia WWW-Authenticate: Bearer no 401', () => {
      sut.catch(new InvalidAccessTokenError(), httpHost());

      expect(adapter.setHeader).toHaveBeenCalledWith(
        response,
        'WWW-Authenticate',
        'Bearer',
      );
      expect(adapter.reply).toHaveBeenCalledWith(
        response,
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'UNAUTHENTICATED',
            reason: 'INVALID_ACCESS_TOKEN',
          }),
        }),
        401,
      );
    });

    it('responde 403 para escopo insuficiente', () => {
      sut.catch(new InsufficientScopeError(), httpHost());

      expect(adapter.reply).toHaveBeenCalledWith(
        response,
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'FORBIDDEN',
            reason: 'INSUFFICIENT_SCOPE',
          }),
        }),
        403,
      );
      expect(adapter.setHeader).not.toHaveBeenCalled();
    });

    it('mascara erros inesperados com 500, sem stack, e registra o original com o requestId', () => {
      const error = new Error('falha interna com detalhe sensível');

      sut.catch(error, httpHost());

      const [, body, status] = adapter.reply.mock.calls[0];
      expect(status).toBe(500);
      expect(body).toEqual({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro interno do servidor.',
          requestId: REQUEST_ID,
        },
      });
      expect(JSON.stringify(body)).not.toContain('sensível');
      expect(logError).toHaveBeenCalledWith(`requestId=${REQUEST_ID}`, error);
      // O middleware já pôs o X-Request-Id; o filtro não repete.
      expect(adapter.setHeader).not.toHaveBeenCalled();
    });

    describe('sem contexto (erro antes do RequestIdMiddleware, ex.: body-parser)', () => {
      beforeEach(() => {
        currentRequestId = undefined;
      });

      it('usa o X-Request-Id válido do cliente no cabeçalho, no corpo e no log', () => {
        const error = new Error('falha');

        sut.catch(
          error,
          httpHost({ headers: { 'x-request-id': 'cli.ent-0_1' } }),
        );

        expect(adapter.setHeader).toHaveBeenCalledWith(
          response,
          'X-Request-Id',
          'cli.ent-0_1',
        );
        expect(adapter.reply.mock.calls[0][1]).toMatchObject({
          error: { requestId: 'cli.ent-0_1' },
        });
        expect(logError).toHaveBeenCalledWith('requestId=cli.ent-0_1', error);
      });

      it.each([
        ['ausente', {}],
        ['inválido', { 'x-request-id': 'com espaço 1' }],
      ])(
        'id %s: gera um UUID, o mesmo no cabeçalho e no corpo',
        (_, headers) => {
          sut.catch(new Error('falha'), httpHost({ headers }));

          const [, , generated] = adapter.setHeader.mock.calls[0];
          expect(generated).toMatch(UUID);
          expect(adapter.reply.mock.calls[0][1]).toMatchObject({
            error: { requestId: generated },
          });
        },
      );

      it('HttpException do Nest também leva o cabeçalho', () => {
        sut.catch(
          new NotFoundException('Cannot GET /x'),
          httpHost({ headers: { 'x-request-id': 'cliente-404' } }),
        );

        expect(adapter.setHeader).toHaveBeenCalledWith(
          response,
          'X-Request-Id',
          'cliente-404',
        );
        expect(adapter.reply.mock.calls[0][2]).toBe(404);
      });

      it('resposta já enviada: não tenta escrever o cabeçalho', () => {
        adapter.isHeadersSent.mockReturnValue(true);

        sut.catch(new Error('falha'), httpHost());

        expect(adapter.setHeader).not.toHaveBeenCalled();
      });
    });

    it('mantém o comportamento padrão do Nest para HttpException', () => {
      sut.catch(new NotFoundException('Cannot GET /x'), httpHost());

      expect(adapter.reply).toHaveBeenCalledWith(
        response,
        { statusCode: 404, message: 'Cannot GET /x', error: 'Not Found' },
        404,
      );
    });
  });
});
