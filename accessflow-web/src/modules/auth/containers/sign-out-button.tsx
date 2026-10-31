"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/infra/mocks/personas";
import { Button } from "@/shared/components/ui/button";

/** Sair fora do shell (onboarding). */
export function SignOutButton() {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        // Fase 11b: limpar a sessão e passar pelo /logout do Cognito.
        signOut();
        router.replace("/");
      }}
    >
      Sair
    </Button>
  );
}
