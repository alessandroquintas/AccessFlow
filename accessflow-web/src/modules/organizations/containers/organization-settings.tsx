"use client";

import { TriangleAlertIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { mockActionError, setScenario, useScenario } from "@/infra/mocks/scenario";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { LoadingRegion } from "@/shared/components/feedback/loading-region";
import { FormSkeleton } from "@/shared/components/feedback/skeletons";
import { LocalDate } from "@/shared/components/local-date";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { apiErrorMessage } from "@/shared/lib/api-errors";
import { OrganizationSettingsForm } from "../components/organization-settings-form";
import { renameOrganization } from "../hooks/use-my-organizations";
import type { Organization } from "../schemas";

/**
 * Só o que a API permite mudar (updateOrganization: o nome). Não há excluir
 * a organização nem transferir a propriedade.
 */
export function OrganizationSettings({ organization }: { organization: Organization }) {
  const pathname = usePathname();
  const scenario = useScenario();
  const [apiError, setApiError] = useState<string | null>(null);

  if (scenario === "error") return <ErrorState onRetry={() => setScenario("normal", pathname)} />;

  const loading = scenario === "loading";

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>
          <h2>Dados da organização</h2>
        </CardTitle>
        <CardDescription>
          {loading ? (
            <span className="flex h-5 items-center" aria-hidden="true">
              <Skeleton className="h-3.5 w-40" />
            </span>
          ) : (
            <>
              Criada em <LocalDate iso={organization.createdAt} />.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <LoadingRegion label="Carregando configurações…">
            <FormSkeleton fields={2} />
          </LoadingRegion>
        ) : (
          <>
            {apiError && (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertTitle>Não foi possível salvar</AlertTitle>
                <AlertDescription>{apiError}</AlertDescription>
              </Alert>
            )}
            <OrganizationSettingsForm
              // Recomeça o formulário ao trocar de organização.
              key={organization.id}
              name={organization.name}
              slug={organization.slug}
              onSubmit={({ name }) => {
                // Fase 11b: chamar updateOrganization.
                const code = mockActionError("ORGANIZATION_PERMISSION_DENIED");
                if (code) {
                  setApiError(apiErrorMessage(code));
                  return false;
                }
                setApiError(null);
                renameOrganization(organization.id, name);
                toast.success("Alterações salvas", { description: name });
                return true;
              }}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
