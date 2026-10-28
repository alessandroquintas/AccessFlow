import { SecurityEventsPage } from '@/modules/organizations/application/dto/security-event-entry';
import { encodeCursor } from '@/shared/presentation/graphql/pagination/cursor';
import { PageInfoType } from '@/shared/presentation/graphql/types/page-info.type';
import { Field, ObjectType } from '@nestjs/graphql';
import { SecurityEventGqlType } from './security-event.type';

@ObjectType('SecurityEventConnection')
export class SecurityEventConnectionType {
  @Field(() => [SecurityEventGqlType])
  nodes!: SecurityEventGqlType[];

  @Field(() => PageInfoType)
  pageInfo!: PageInfoType;

  static from(page: SecurityEventsPage): SecurityEventConnectionType {
    const last = page.items.at(-1)?.event;

    const type = new SecurityEventConnectionType();
    type.nodes = page.items.map(SecurityEventGqlType.from);
    type.pageInfo = {
      hasNextPage: page.hasNextPage,
      // O mesmo formato de cursor das outras listagens: instante e id.
      endCursor: last
        ? encodeCursor({ createdAt: last.occurredAt, id: last.id })
        : null,
    };
    return type;
  }
}
