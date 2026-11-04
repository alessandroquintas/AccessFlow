"use client";

import { RequireSession } from "@/modules/auth/containers/require-session";
import { SidebarInset, SidebarProvider } from "@/shared/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

/** Telas autenticadas: sidebar (gaveta no celular) e área de conteúdo. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireSession profile="required">
      {/* Primeiro foco da página: pula a sidebar inteira. */}
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:ring-2 focus-visible:ring-ring"
      >
        Pular para o conteúdo
      </a>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset id="conteudo" tabIndex={-1} className="min-w-0 outline-none">
          {children}
        </SidebarInset>
      </SidebarProvider>
    </RequireSession>
  );
}
