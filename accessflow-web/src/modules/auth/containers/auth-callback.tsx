"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { hasProfile, sessionStore } from "@/infra/mocks/personas";
import { FullPageStatus } from "../components/full-page-status";
import { parseReturnTo } from "../schemas";

/** Pausa curta só para a tela de callback aparecer no mock. */
const MOCK_EXCHANGE_MS = 900;

export function AuthCallback() {
  const router = useRouter();
  const next = parseReturnTo(useSearchParams().get("next"));

  useEffect(() => {
    // Fase 11b: trocar o `code` da URL pelos tokens (PKCE) e guardar a sessão.
    const timer = setTimeout(() => {
      const session = sessionStore.get();
      if (!session.signedIn) router.replace("/");
      // Sem perfil, o onboarding vem antes de qualquer tela.
      else router.replace(hasProfile(session) ? (next ?? "/organizations") : "/onboarding");
    }, MOCK_EXCHANGE_MS);
    return () => clearTimeout(timer);
  }, [router, next]);

  return <FullPageStatus message="Entrando no AccessFlow…" />;
}
