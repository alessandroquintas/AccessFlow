"use client";

import { toast } from "sonner";
import { setScenario, useScenario } from "@/infra/mocks/scenario";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { LocalDate } from "@/shared/components/local-date";
import { usePathname } from "next/navigation";
import { ProfileNameForm } from "../components/profile-name-form";
import { useViewerProfile } from "../hooks/use-viewer-profile";

export function ProfileSettings() {
  const pathname = usePathname();
  const scenario = useScenario();
  const { profile, email } = useViewerProfile();

  if (scenario === "error") {
    return <ErrorState onRetry={() => setScenario("normal", pathname)} />;
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Dados pessoais</CardTitle>
        <CardDescription>
          {profile && scenario !== "loading" ? (
            <>
              Conta criada em <LocalDate iso={profile.createdAt} />.
            </>
          ) : (
            "Carregando…"
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {scenario === "loading" || !profile ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-8 w-32" />
          </div>
        ) : (
          <ProfileNameForm
            // Recomeça o formulário quando a persona muda.
            key={email}
            email={email}
            defaultName={profile.name}
            submitLabel="Salvar alterações"
            submittingLabel="Salvando…"
            onSubmit={() => {
              // Fase 11b: chamar updateMyProfile.
              toast.success("Perfil atualizado");
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
