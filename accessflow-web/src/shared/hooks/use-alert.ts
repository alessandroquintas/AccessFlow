"use client";

import { useSnackbar, type VariantType } from "notistack";
import { useCallback, useMemo } from "react";

interface AlertArgs {
  variant: VariantType;
  message: string;
  hideDuration?: number;
  anchorOrigin?: {
    horizontal: "right" | "left" | "center";
    vertical: "top" | "bottom";
  };
}

export const useAlert = () => {
  const { enqueueSnackbar } = useSnackbar();

  const Alert = useCallback(
    ({ variant, message, hideDuration, anchorOrigin }: AlertArgs) => {
      enqueueSnackbar(message, {
        anchorOrigin: anchorOrigin ?? { horizontal: "right", vertical: "bottom" },
        variant,
        autoHideDuration: hideDuration ?? 3000,
        preventDuplicate: true,
      });
    },
    [enqueueSnackbar],
  );

  return useMemo(() => ({ Alert }), [Alert]);
};
