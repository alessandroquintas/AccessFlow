import { graphql } from "@/infra/graphql/generated";

export const MeQuery = graphql(`
  query Me {
    me {
      id
      name
      email
    }
  }
`);
