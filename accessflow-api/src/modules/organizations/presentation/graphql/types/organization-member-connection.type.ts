import { OrganizationMembersPage } from '@/modules/organizations/application/dto/organization-member';
import { encodeCursor } from '@/shared/presentation/graphql/pagination/cursor';
import { PageInfoType } from '@/shared/presentation/graphql/types/page-info.type';
import { Field, ObjectType } from '@nestjs/graphql';
import { OrganizationMemberType } from './organization-member.type';

@ObjectType('OrganizationMemberConnection')
export class OrganizationMemberConnectionType {
  @Field(() => [OrganizationMemberType])
  nodes!: OrganizationMemberType[];

  @Field(() => PageInfoType)
  pageInfo!: PageInfoType;

  static from(page: OrganizationMembersPage): OrganizationMemberConnectionType {
    const last = page.items.at(-1)?.membership;

    const type = new OrganizationMemberConnectionType();
    type.nodes = page.items.map(OrganizationMemberType.from);
    type.pageInfo = {
      hasNextPage: page.hasNextPage,
      endCursor: last
        ? encodeCursor({ createdAt: last.createdAt, id: last.id })
        : null,
    };
    return type;
  }
}
