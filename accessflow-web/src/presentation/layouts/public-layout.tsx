import { Suspense } from "react";
import { DevToolbar } from "@/presentation/dev/dev-toolbar";
import { Logo } from "@/shared/components/brand/logo";
import { ThemeToggle } from "@/shared/components/theme-toggle";

/** Telas sem sessão: marca, tema e o seletor de persona flutuante. */
export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      {process.env.NODE_ENV !== "production" && (
        <Suspense fallback={null}>
          <DevToolbar />
        </Suspense>
      )}
    </div>
  );
}
