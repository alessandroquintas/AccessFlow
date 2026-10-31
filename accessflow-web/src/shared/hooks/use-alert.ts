"use client";

import { useCallback, useMemo } from "react";
import { toast } from "sonner";

type AlertVariant = "default" | "success" | "error" | "info" | "warning";

interface AlertArgs {
  variant: AlertVariant;
  message: string;
  description?: string;
  hideDuration?: number;
}

export const useAlert = () => {
  const Alert = useCallback(
    ({ variant, message, description, hideDuration }: AlertArgs) => {
      const show = variant === "default" ? toast : toast[variant];

      // O id pela mensagem evita o mesmo toast empilhado (cliques repetidos).
      show(message, { id: message, description, duration: hideDuration ?? 4000 });
    },
    [],
  );

  return useMemo(() => ({ Alert }), [Alert]);
};
