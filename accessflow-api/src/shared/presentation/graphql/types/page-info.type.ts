import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('PageInfo')
export class PageInfoType {
  @Field()
  hasNextPage!: boolean;

  @Field(() => String, { nullable: true })
  endCursor!: string | null;
}
