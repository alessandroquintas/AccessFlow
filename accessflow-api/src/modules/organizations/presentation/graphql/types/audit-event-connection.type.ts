import { AuditEventsPage } from '@/modules/organizations/application/dto/audit-event-entry';
import { encodeCursor } from '@/shared/presentation/graphql/pagination/cursor';
import { PageInfoType } from '@/shared/presentation/graphql/types/page-info.type';
import { Field, ObjectType } from '@nestjs/graphql';
import { AuditEventGqlType } from './audit-event.type';

@ObjectType('AuditEventConnection')
export class AuditEventConnectionType {
  @Field(() => [AuditEventGqlType])
  nodes!: AuditEventGqlType[];

  @Field(() => PageInfoType)
  pageInfo!: PageInfoType;

  static from(page: AuditEventsPage): AuditEventConnectionType {
    const last = page.items.at(-1)?.event;

    const type = new AuditEventConnectionType();
    type.nodes = page.items.map(AuditEventGqlType.from);
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
