import { OrganizationInvitationsPage } from '@/modules/organizations/application/dto/organization-invitation';
import { encodeCursor } from '@/shared/presentation/graphql/pagination/cursor';
import { PageInfoType } from '@/shared/presentation/graphql/types/page-info.type';
import { Field, ObjectType } from '@nestjs/graphql';
import { OrganizationInvitationType } from './organization-invitation.type';

@ObjectType('OrganizationInvitationConnection')
export class OrganizationInvitationConnectionType {
  @Field(() => [OrganizationInvitationType])
  nodes!: OrganizationInvitationType[];

  @Field(() => PageInfoType)
  pageInfo!: PageInfoType;

  static from(
    page: OrganizationInvitationsPage,
    now: Date,
  ): OrganizationInvitationConnectionType {
    const last = page.items.at(-1)?.invitation;

    const type = new OrganizationInvitationConnectionType();
    type.nodes = page.items.map((item) =>
      OrganizationInvitationType.from(item, now),
    );
    type.pageInfo = {
      hasNextPage: page.hasNextPage,
      endCursor: last
        ? encodeCursor({ createdAt: last.createdAt, id: last.id })
        : null,
    };
    return type;
  }
}
