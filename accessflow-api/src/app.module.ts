import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { EnvModule } from './config/env.module';
import { IdentityModule } from './modules/identity/identity.module';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { formatGraphqlError } from './shared/presentation/graphql/format-graphql-error';
import { join } from 'node:path';
import { APP_FILTER } from '@nestjs/core';
import { DomainErrorFilter } from './shared/presentation/domain-error.filter';
import { SecurityDenialFilter } from './shared/presentation/security-denial.filter';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { RequestContextModule } from './shared/infrastructure/request-context/request-context.module';
import { RequestContextPort } from './shared/application/ports/request-context.port';
import { RequestIdMiddleware } from './shared/presentation/http/request-id.middleware';
import { HealthModule } from './shared/infrastructure/health/health.module';

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [RequestContextModule],
      inject: [RequestContextPort],
      useFactory: (requestContext: RequestContextPort) => ({
        autoSchemaFile: join(process.cwd(), 'src/graphql/schema.gql'),
        sortSchema: true,
        context: ({ req }: { req: unknown }) => ({ req }),
        includeStacktraceInErrorResponses: false,
        formatError: (formatted) =>
          formatGraphqlError(formatted, requestContext.requestId()),
      }),
    }),
    EnvModule,
    RequestContextModule,
    IdentityModule,
    OrganizationsModule,
    HealthModule,
  ],
  providers: [
    // Traduz os erros; o filtro global grava as negações e repassa a ele.
    DomainErrorFilter,
    {
      provide: APP_FILTER,
      useClass: SecurityDenialFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Middleware do módulo, e não app.use no main.ts, para valer também nas
    // aplicações dos testes, que não passam pelo main.ts.
    consumer.apply(RequestIdMiddleware).forRoutes('{*path}');
  }
}
