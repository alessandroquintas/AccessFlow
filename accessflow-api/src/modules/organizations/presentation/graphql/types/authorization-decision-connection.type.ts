import { AuthorizationDecisionPage } from '@/modules/organizations/domain/repositories/authorization-decision-log.repository';
import { encodeCursor } from '@/shared/presentation/graphql/pagination/cursor';
import { PageInfoType } from '@/shared/presentation/graphql/types/page-info.type';
import { Field, ObjectType } from '@nestjs/graphql';
import { AuthorizationDecisionGqlType } from './authorization-decision.type';

@ObjectType('AuthorizationDecisionConnection')
export class AuthorizationDecisionConnectionType {
  @Field(() => [AuthorizationDecisionGqlType])
  nodes!: AuthorizationDecisionGqlType[];

  @Field(() => PageInfoType)
  pageInfo!: PageInfoType;

  static from(
    page: AuthorizationDecisionPage,
  ): AuthorizationDecisionConnectionType {
    const last = page.items.at(-1)?.decision;

    const type = new AuthorizationDecisionConnectionType();
    type.nodes = page.items.map(AuthorizationDecisionGqlType.from);
    type.pageInfo = {
      hasNextPage: page.hasNextPage,
      // O mesmo formato de cursor das outras listagens: instante e id.
      endCursor: last
        ? encodeCursor({ createdAt: last.decidedAt, id: last.id })
        : null,
    };
    return type;
  }
}
