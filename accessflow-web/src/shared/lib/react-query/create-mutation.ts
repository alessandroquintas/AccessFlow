"use client";

import {
  type InvalidateQueryFilters,
  type MutationFunction,
  type MutationKey,
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useAlert } from "@/shared/hooks/use-alert";

type Message<TArgs extends unknown[]> = string | ((...args: TArgs) => string);

type InvalidateTargets<TData, TVariables> =
  | InvalidateQueryFilters[]
  | ((data: TData, variables: TVariables) => InvalidateQueryFilters[]);

interface CreateMutationArgs<TData, TVariables, TError> {
  key: MutationKey;
  mutationFn: MutationFunction<TData, TVariables>;
  messages?: {
    onMutate?: Message<[variables: TVariables]>;
    onSuccess?: Message<[data: TData, variables: TVariables]>;
    onError?: Message<[error: TError, variables: TVariables]>;
  };
  invalidate?: InvalidateTargets<TData, TVariables>;
}

type MutationHookOptions<TData, TVariables, TError, TOnMutateResult> = Omit<
  UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
  "mutationKey" | "mutationFn"
>;

const resolveMessage = <TArgs extends unknown[]>(
  message: Message<TArgs>,
  ...args: TArgs
) => (typeof message === "function" ? message(...args) : message);

export const createMutation = <
  TData,
  TVariables = void,
  TError = AxiosError,
>({
  key,
  mutationFn,
  messages,
  invalidate,
}: CreateMutationArgs<TData, TVariables, TError>) => {
  return function useCreatedMutation<TOnMutateResult = unknown>(
    options?: MutationHookOptions<TData, TVariables, TError, TOnMutateResult>,
  ): UseMutationResult<TData, TError, TVariables, TOnMutateResult> {
    const { onMutate, onSuccess, onError, ...config } = options ?? {};
    const queryClient = useQueryClient();
    const { Alert } = useAlert();

    const invalidateQueries = (data: TData, variables: TVariables) => {
      if (!invalidate) return;

      const targets =
        typeof invalidate === "function"
          ? invalidate(data, variables)
          : invalidate;

      return Promise.all(
        targets.map((filters) => queryClient.invalidateQueries(filters)),
      );
    };

    return useMutation<TData, TError, TVariables, TOnMutateResult>({
      ...config,
      mutationKey: key,
      mutationFn,
      onMutate: (variables, context) => {
        if (messages?.onMutate) {
          Alert({
            variant: "info",
            message: resolveMessage(messages.onMutate, variables),
          });
        }

        // O retorno vira o `onMutateResult` (necessário para optimistic updates).
        return onMutate?.(variables, context) as
          | TOnMutateResult
          | Promise<TOnMutateResult>;
      },
      onSuccess: async (data, variables, onMutateResult, context) => {
        await invalidateQueries(data, variables);

        if (messages?.onSuccess) {
          Alert({
            variant: "success",
            message: resolveMessage(messages.onSuccess, data, variables),
          });
        }

        return onSuccess?.(data, variables, onMutateResult, context);
      },
      onError: (error, variables, onMutateResult, context) => {
        if (messages?.onError) {
          Alert({
            variant: "error",
            message: resolveMessage(messages.onError, error, variables),
          });
        }

        return onError?.(error, variables, onMutateResult, context);
      },
    });
  };
};
