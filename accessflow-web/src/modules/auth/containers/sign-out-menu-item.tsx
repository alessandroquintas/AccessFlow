"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "@/infra/mocks/personas";
import { DropdownMenuItem } from "@/shared/components/ui/dropdown-menu";

export function SignOutMenuItem() {
  const router = useRouter();

  return (
    <DropdownMenuItem
      onClick={() => {
        // Fase 11b: limpar a sessão e passar pelo /logout do Cognito.
        signOut();
        router.replace("/");
      }}
    >
      <LogOutIcon />
      Sair
    </DropdownMenuItem>
  );
}
