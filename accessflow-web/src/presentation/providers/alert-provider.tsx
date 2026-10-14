"use client";

import { SnackbarProvider } from "notistack";

export function AlertProvider({ children }: { children: React.ReactNode }) {
  return <SnackbarProvider maxSnack={3}>{children}</SnackbarProvider>;
}
