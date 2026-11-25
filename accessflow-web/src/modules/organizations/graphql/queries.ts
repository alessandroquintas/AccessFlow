import { graphql } from "@/infra/graphql/generated";

export const OrganizationMembersQuery = graphql(`
  query OrganizationMember($organizationId: ID!, $first: Int, $after: String) {
    organizationMembers(
      organizationId: $organizationId
      first: $first
      after: $after
    ) {
      nodes {
        userId
        name
        email
        joinedAt
        assignedRole {
          id
          name
          systemKey
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);
