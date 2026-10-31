"use client";

import { RequireSession } from "@/modules/auth/containers/require-session";
import { SidebarInset, SidebarProvider } from "@/shared/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

/** Telas autenticadas: sidebar (gaveta no celular) e área de conteúdo. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireSession profile="required">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">{children}</SidebarInset>
      </SidebarProvider>
    </RequireSession>
  );
}
