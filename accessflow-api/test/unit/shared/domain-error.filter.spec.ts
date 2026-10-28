import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpServer, Logger, NotFoundException } from '@nestjs/common';
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

const response = { tipo: 'resposta-http' };

let adapter: {
  reply: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  isHeadersSent: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
};
let logError: ReturnType<typeof vi.spyOn>;
let sut: DomainErrorFilter;

function httpHost() {
  const host = new ExecutionContextHost([{}, response, () => undefined]);
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
    sut = new DomainErrorFilter(adapter as unknown as HttpServer);
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
    ])('traduz %s para %s', (error, code) => {
      const result = sut.catch(error, graphqlHost()) as GraphQLError;

      expect(result).toBeInstanceOf(GraphQLError);
      expect(result.message).toBe(error.message);
      expect(result.extensions).toEqual({ code, reason: error.code });
      expect(adapter.reply).not.toHaveBeenCalled();
    });

    it('registra e repassa erros inesperados (o formatError mascara)', () => {
      const error = new Error('falha interna');

      expect(() => sut.catch(error, graphqlHost())).toThrow(error);
      expect(logError).toHaveBeenCalledWith(error);
    });

    it('repassa HttpException sem registrar', () => {
      const error = new NotFoundException();

      expect(() => sut.catch(error, graphqlHost())).toThrow(error);
      expect(logError).not.toHaveBeenCalled();
    });
  });

  describe('HTTP', () => {
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

    it('mascara erros inesperados com 500, sem stack, e registra o original', () => {
      const error = new Error('falha interna com detalhe sensível');

      sut.catch(error, httpHost());

      const [, body, status] = adapter.reply.mock.calls[0];
      expect(status).toBe(500);
      expect(body).toEqual({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro interno do servidor.',
        },
      });
      expect(JSON.stringify(body)).not.toContain('sensível');
      expect(logError).toHaveBeenCalledWith(error);
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
