import { Module } from '@nestjs/common';
import { EnvModule } from './config/env.module';
import { IdentityModule } from './modules/identity/identity.module';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { formatGraphqlError } from './shared/presentation/graphql/format-graphql-error';
import { join } from 'node:path';
import { APP_FILTER } from '@nestjs/core';
import { DomainErrorFilter } from './shared/presentation/graphql/domain-error.filter';
import { OrganizationsModule } from './modules/organizations/organizations.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/graphql/schema.gql'),
      sortSchema: true,
      context: ({ req }: { req: unknown }) => ({ req }),
      includeStacktraceInErrorResponses: false,
      formatError: formatGraphqlError,
    }),
    EnvModule,
    IdentityModule,
    OrganizationsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: DomainErrorFilter,
    },
  ],
})
export class AppModule {}
