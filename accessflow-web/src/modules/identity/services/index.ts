import { api } from "@/infra/http/graphql/api";
import { MeQuery } from "../graphql/queries";
import { ProvisionMeMutation } from "../graphql/mutation";
import type { ProvisionMeMutationTypes } from "./types";

export const meQuery = async () => {
  const response = await api.request(MeQuery);
  const result = response.me;

  return result;
};

export const provisionMeMutation = async (
  args: ProvisionMeMutationTypes.Args,
) => {
  const { name } = args;
  const response = await api.request(ProvisionMeMutation, {
    input: {
      name,
    },
  });

  const result = response.provisionMe;
  return result;
};
