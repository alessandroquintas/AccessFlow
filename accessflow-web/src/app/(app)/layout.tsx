import { Suspense } from "react";
import { AppShell } from "@/presentation/layouts/app-shell";
import { AppShellSkeleton } from "@/shared/components/feedback/skeletons";

export default function Layout({ children }: { children: React.ReactNode }) {
  // O shell lê a rota (useParams/usePathname): com cacheComponents, fica sob Suspense.
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
