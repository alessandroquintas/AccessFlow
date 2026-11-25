import { createQuery } from "@/shared/lib/react-query/create-query";
import { getOrganizationMembers } from "../services";

export const useGetOrganizationMembers = createQuery({
  queryKey: ["organization-members"],
  queryFn: getOrganizationMembers,
});
