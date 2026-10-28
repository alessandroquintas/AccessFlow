import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { GqlArgumentsHost, GqlContextType } from '@nestjs/graphql';
import type { GraphQLResolveInfo } from 'graphql';
import { DomainError } from '@/shared/domain/errors/domain.error';
import type { SecurityDenial } from '@/shared/domain/security-denial';
import { RequestContextPort } from '@/shared/application/ports/request-context.port';
import {
  DenialOrigin,
  SecurityDenialRecorder,
} from '@/shared/application/ports/security-denial-recorder.port';
import { DomainErrorFilter } from './domain-error.filter';

/** O que se lê da requisição aqui. */
interface DeniedRequest {
  method?: string;
  path?: string;
  route?: { path?: unknown };
  identity?: { sub?: string };
}

/**
 * Filtro global: grava a negação de acesso como evento de segurança e
 * depois responde como o DomainErrorFilter, a quem repassa todo erro.
 *
 * Gravar aqui, e não onde a negação acontece, mantém o evento fora da
 * transação da ação: o filtro só roda quando o handler já terminou, com a
 * transação desfeita, suas travas soltas e sua conexão de volta ao pool.
 * Gravando lá dentro por outra conexão, cada negação seguraria duas conexões
 * ao mesmo tempo; com o pool tomado por transações à espera da mesma
 * organização, a gravação esperaria uma conexão que só volta quando ela
 * mesma terminar.
 *
 * A falha ao gravar não muda a resposta: vai para o log, com o requestId.
 */
@Catch()
export class SecurityDenialFilter implements ExceptionFilter {
  private readonly logger = new Logger(SecurityDenialFilter.name);

  constructor(
    private readonly errors: DomainErrorFilter,
    private readonly recorder: SecurityDenialRecorder,
    private readonly requestContext: RequestContextPort,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const denial =
      exception instanceof DomainError ? exception.securityDenial : undefined;
    if (!denial) return this.errors.catch(exception, host);

    // A resposta espera a gravação: quem recebe o 403 já encontra o evento.
    return this.record(denial, host).then(() =>
      this.errors.catch(exception, host),
    );
  }

  private async record(
    denial: SecurityDenial,
    host: ArgumentsHost,
  ): Promise<void> {
    try {
      await this.recorder.record(denial, originOf(host));
    } catch (error) {
      this.logger.error(
        `Evento ${denial.event} não gravado; requestId=${this.requestContext.requestId() ?? '-'}`,
        error,
      );
    }
  }
}

/** Operação GraphQL ou rota HTTP declarada, e o usuário autenticado. */
function originOf(host: ArgumentsHost): DenialOrigin {
  if (host.getType<GqlContextType>() === 'graphql') {
    const gql = GqlArgumentsHost.create(host);
    return {
      operation: gql.getInfo<GraphQLResolveInfo>().fieldName,
      userSub: gql.getContext<{ req?: DeniedRequest }>().req?.identity?.sub,
    };
  }

  const request = host.switchToHttp().getRequest<DeniedRequest>();
  // O caminho declarado (com :organizationId), e não o pedido: sem ids, e
  // igual para todas as chamadas da rota.
  const path =
    typeof request.route?.path === 'string' ? request.route.path : request.path;
  return {
    route: `${request.method} ${path}`,
    userSub: request.identity?.sub,
  };
}
