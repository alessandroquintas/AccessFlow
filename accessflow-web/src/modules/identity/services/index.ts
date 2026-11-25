import { api } from "@/infra/http/graphql/api";
import { MeQuery } from "../graphql/queries";

export const meQuery = async () => {
  const response = await api.request(MeQuery);
  const result = response.me;

  return result;
};
