"use client";

import {
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";
import type { AxiosError } from "axios";

type QueryHookOptions<TResponse, TError> = Omit<
  UseQueryOptions<TResponse, TError>,
  "queryKey" | "queryFn"
>;

interface CreateQueryArgs<TArgs, TResponse> {
  queryKey: QueryKey;
  queryFn: (args: TArgs) => Promise<TResponse>;
}

export const createQuery = <TArgs, TResponse, TError = AxiosError>(
  { queryKey, queryFn }: CreateQueryArgs<TArgs, TResponse>,
  defaultOptions?: QueryHookOptions<TResponse, TError>,
) => {
  return function useCreatedQuery(
    args: TArgs,
    options?: QueryHookOptions<TResponse, TError>,
  ): UseQueryResult<TResponse, TError> {
    return useQuery<TResponse, TError>({
      ...defaultOptions,
      ...options,
      queryKey: [...queryKey, args],
      queryFn: () => queryFn(args),
    });
  };
};
