import { graphql } from "@/infra/graphql/generated";

export const ProvisionMeMutation = graphql(`
  mutation ProvisionMe($input: ProvisionMeInput!) {
    provisionMe(input: $input) {
      id
      name
    }
  }
`);
