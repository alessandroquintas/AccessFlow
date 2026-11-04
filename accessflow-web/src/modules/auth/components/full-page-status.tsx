import { LoadingRegion } from "@/shared/components/feedback/loading-region";
import { AppShellSkeleton, CenteredCardSkeleton } from "@/shared/components/feedback/skeletons";

interface FullPageStatusProps {
  /** Lido pelos leitores de tela. */
  message: string;
  /** app: a casca do painel; card: o cartão centralizado do onboarding. */
  layout?: "app" | "card";
}

/** Tela inteira de espera (callback de login e checagem de sessão), no formato da tela que vem. */
export function FullPageStatus({ message, layout = "app" }: FullPageStatusProps) {
  return (
    <LoadingRegion label={message} className="flex min-h-svh flex-1">
      {layout === "app" ? <AppShellSkeleton /> : <CenteredCardSkeleton />}
    </LoadingRegion>
  );
}
