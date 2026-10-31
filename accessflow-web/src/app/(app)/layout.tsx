import { Suspense } from "react";
import { AppShell } from "@/presentation/layouts/app-shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  // O shell lê a rota (useParams/usePathname): com cacheComponents, fica sob Suspense.
  return (
    <Suspense fallback={<div className="min-h-svh" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
