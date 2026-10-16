import { Module } from '@nestjs/common';
import { EnvModule } from './config/env.module';
import { IdentityModule } from './modules/identity/identity.module';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { formatGraphqlError } from './shared/presentation/graphql/format-graphql-error';
import { join } from 'node:path';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      context: ({ req }: { req: unknown }) => ({ req }),
      includeStacktraceInErrorResponses: false,
      formatError: formatGraphqlError,
    }),
    EnvModule,
    IdentityModule,
  ],
})
export class AppModule {}
