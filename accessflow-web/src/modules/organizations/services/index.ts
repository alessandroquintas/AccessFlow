import { OrganizationMembersQuery } from "../graphql/queries";
import { api } from "@/infra/http/graphql/api";
import { GetOrganizationMembers } from "./types";

export const getOrganizationMembers = async (
  args: GetOrganizationMembers.Args,
) => {
  const { organizationId, after, first } = args;

  const response = await api.request(OrganizationMembersQuery, {
    organizationId,
    after,
    first,
  });

  const result = response.organizationMembers;

  return result;
};
