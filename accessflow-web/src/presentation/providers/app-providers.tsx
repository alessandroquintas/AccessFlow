"use client";

import { AlertProvider } from "./alert-provider";
import { QueryProvider } from "./query-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AlertProvider>{children}</AlertProvider>
    </QueryProvider>
  );
}
