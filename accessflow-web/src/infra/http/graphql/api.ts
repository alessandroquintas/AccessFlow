import { GraphQLClient } from "graphql-request";
import { env } from "@/infra/config";

export const api = new GraphQLClient(env.NEXT_PUBLIC_API_URL);
