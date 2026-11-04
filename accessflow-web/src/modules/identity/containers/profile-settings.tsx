"use client";

import { toast } from "sonner";
import { setScenario, useScenario } from "@/infra/mocks/scenario";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { LoadingRegion } from "@/shared/components/feedback/loading-region";
import { FormSkeleton } from "@/shared/components/feedback/skeletons";
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
            <span className="flex h-5 items-center" aria-hidden="true">
              <Skeleton className="h-3.5 w-40" />
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {scenario === "loading" || !profile ? (
          <LoadingRegion label="Carregando perfil…">
            <FormSkeleton fields={2} />
          </LoadingRegion>
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
