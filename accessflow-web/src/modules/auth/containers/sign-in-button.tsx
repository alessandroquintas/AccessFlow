"use client";

import { LogInIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/infra/mocks/personas";
import { Button } from "@/shared/components/ui/button";
import { parseReturnTo } from "../schemas";

/** Entrar. Leva junto o `next` da URL, para voltar à tela pedida. */
export function SignInButton() {
  const router = useRouter();
  const next = parseReturnTo(useSearchParams().get("next"));

  return (
    <Button
      size="lg"
      onClick={() => {
        // Fase 11b: redirecionar para o Hosted UI do Cognito (/oauth2/authorize,
        // com PKCE), levando o `next` no `state`. No mock, entra direto com a
        // persona escolhida no seletor.
        signIn();
        router.push(next ? `/auth/callback?next=${encodeURIComponent(next)}` : "/auth/callback");
      }}
    >
      <LogInIcon data-icon="inline-start" />
      Entrar
    </Button>
  );
}
