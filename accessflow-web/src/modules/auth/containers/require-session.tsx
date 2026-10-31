"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { hasProfile, sessionStore } from "@/infra/mocks/personas";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { useStore } from "@/infra/mocks/use-store";
import { FullPageStatus } from "../components/full-page-status";

interface RequireSessionProps {
  /**
   * required: telas do app (sem perfil, vai para o onboarding).
   * missing: o próprio onboarding (com perfil, vai para as organizações).
   */
  profile: "required" | "missing";
  children: React.ReactNode;
}

/**
 * Guard de sessão no cliente, sobre a sessão mock do localStorage.
 * Fase 11b: a checagem passa a ser da sessão real (cookie), de preferência
 * no proxy.ts, antes de renderizar.
 */
export function RequireSession({ profile, children }: RequireSessionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const session = useStore(sessionStore);
  const target = !session.signedIn
    ? `/?next=${encodeURIComponent(pathname)}`
    : profile === "required" && !hasProfile(session)
      ? "/onboarding"
      : profile === "missing" && hasProfile(session)
        ? "/organizations"
        : null;

  useEffect(() => {
    if (hydrated && target) router.replace(target);
  }, [hydrated, target, router]);

  const ready = hydrated && !target;

  // O conteúdo é renderizado mesmo antes de decidir (escondido), para o Next
  // conseguir pré-renderizar o segmento; a espera cobre a tela até lá.
  return (
    <>
      {!ready && <FullPageStatus message="Verificando sua sessão…" />}
      <div className={ready ? "contents" : "hidden"}>{children}</div>
    </>
  );
}
