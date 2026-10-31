"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeOnboarding } from "@/infra/mocks/personas";
import { ProfileNameForm } from "../components/profile-name-form";
import { useViewerProfile } from "../hooks/use-viewer-profile";

/** Primeiro acesso: informar o nome (equivale ao `provisionMe`). */
export function Onboarding() {
  const router = useRouter();
  const { email } = useViewerProfile();

  return (
    <ProfileNameForm
      email={email}
      submitLabel="Continuar"
      submittingLabel="Criando perfil…"
      onSubmit={({ name }) => {
        // Fase 11b: chamar provisionMe e só então seguir.
        completeOnboarding(name);
        toast.success("Perfil criado");
        router.replace("/organizations");
      }}
    />
  );
}
