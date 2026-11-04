"use client";

import { CableIcon, PlusIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { mockActionError, setScenario, useScenario } from "@/infra/mocks/scenario";
import { PermissionCheck } from "@/modules/access-control/containers/permission-check";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { LoadingRegion } from "@/shared/components/feedback/loading-region";
import { ListSkeleton, TableSkeleton } from "@/shared/components/feedback/skeletons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { apiErrorMessage } from "@/shared/lib/api-errors";
import { CreateIntegrationDialog } from "../components/create-integration-dialog";
import { INTEGRATION_COLUMNS, IntegrationList } from "../components/integration-list";
import { SecretDialog } from "../components/secret-dialog";
import { fakeClientId, fakeClientSecret } from "../fixtures/fake-credentials";
import { TOKEN_ENDPOINT } from "../fixtures/integrations";
import { useIntegrations } from "../hooks/use-integrations";
import type { CreatedIntegration, Integration } from "../schemas";

interface IntegrationsProps {
  organizationId: string;
  /** Quem cria aparece como "Criada por" (na API, vem do token). */
  viewerName: string;
}

export function Integrations({ organizationId, viewerName }: IntegrationsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scenario = useScenario();
  const { integrations, used, limit, add, markRevoked } = useIntegrations(organizationId);
  // /integrations?create=1: a ação rápida "Criar integração" da visão geral.
  const [createOpen, setCreateOpen] = useState(searchParams.get("create") === "1");
  const [apiError, setApiError] = useState<string | null>(null);
  // O segredo vive só aqui, até a pessoa confirmar que o guardou.
  const [created, setCreated] = useState<CreatedIntegration | null>(null);
  const [revoking, setRevoking] = useState<{ integration: Integration; open: boolean } | null>(null);

  if (scenario === "loading") {
    return (
      <LoadingRegion label="Carregando integrações…" className="flex flex-col gap-4">
        <span aria-hidden="true" className="flex h-8 items-center">
          <Skeleton className="h-3.5 w-64" />
        </span>
        <TableSkeleton columns={INTEGRATION_COLUMNS} rows={4} className="hidden md:block" />
        <ListSkeleton rows={3} icon={false} lines={4} trailing="action" className="rounded-lg border px-3 py-3 md:hidden" />
      </LoadingRegion>
    );
  }

  if (scenario === "error") return <ErrorState onRetry={() => setScenario("normal", pathname)} />;

  const shown = scenario === "empty" ? [] : integrations;
  const usedSlots = scenario === "empty" ? 0 : used;
  const atLimit = usedSlots >= limit;

  const closeCreate = () => {
    setCreateOpen(false);
    if (searchParams.has("create")) router.replace(pathname);
  };

  return (
    <PermissionCheck organizationId={organizationId}>
      {(can) => {
        const canManage = can("integrations:manage");
        const viewerPermissions = ["members:read", "roles:read"].filter((key) => can(key));
        const createButton = canManage && (
          <Button
            onClick={() => {
              setApiError(null);
              setCreateOpen(true);
            }}
            disabled={atLimit}
            aria-describedby="integration-limit"
          >
            <PlusIcon data-icon="inline-start" />
            Criar integração
          </Button>
        );

        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p id="integration-limit" className="text-sm text-muted-foreground" aria-live="polite">
                <span className="tabular-nums">
                  {usedSlots} de {limit}
                </span>{" "}
                integrações ativas ou em criação.
                {canManage && atLimit && " Limite atingido: revogue uma integração ativa para criar outra."}
              </p>
              {shown.length > 0 && createButton}
            </div>

            {shown.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CableIcon />
                  </EmptyMedia>
                  <EmptyTitle>Nenhuma integração</EmptyTitle>
                  <EmptyDescription>Crie uma integração para que um sistema consulte permissões pela API.</EmptyDescription>
                </EmptyHeader>
                {createButton && <EmptyContent>{createButton}</EmptyContent>}
              </Empty>
            ) : (
              <IntegrationList
                integrations={shown}
                canManage={canManage}
                onRevoke={(integration) => setRevoking({ integration, open: true })}
              />
            )}

            <CreateIntegrationDialog
              open={createOpen && canManage && !atLimit}
              onOpenChange={(open) => !open && closeCreate()}
              viewerPermissions={viewerPermissions}
              apiError={apiError}
              onSubmit={({ name, scopes }) => {
                // Fase 11b: chamar createIntegrationClient. Cada tentativa com o erro simulado mostra um código.
                const code = mockActionError(
                  "INTEGRATION_LIMIT_REACHED",
                  "PRIVILEGE_ESCALATION",
                  "INTEGRATION_PROVISIONING_FAILED",
                );
                const base = {
                  id: `int-${crypto.randomUUID()}`,
                  name,
                  scopes,
                  createdBy: { userId: "viewer", name: viewerName },
                  createdAt: new Date().toISOString(),
                  revokedAt: null,
                };
                if (code === "INTEGRATION_PROVISIONING_FAILED") {
                  // A API grava a tentativa como FAILED (sem client_id, sem ocupar vaga).
                  add({ ...base, clientId: null, status: "FAILED" });
                }
                if (code) {
                  setApiError(apiErrorMessage(code));
                  return;
                }
                const integration: Integration = { ...base, clientId: fakeClientId(), status: "ACTIVE" };
                add(integration);
                closeCreate();
                setCreated({ integration, clientSecret: fakeClientSecret() });
              }}
            />

            <SecretDialog
              created={created}
              tokenEndpoint={TOKEN_ENDPOINT}
              onDone={() => {
                const name = created?.integration.name;
                // Descarta o segredo: daqui em diante ele não existe mais no navegador.
                setCreated(null);
                toast.success("Integração criada", { description: name });
              }}
            />

            <AlertDialog
              open={revoking?.open ?? false}
              onOpenChange={(open) => !open && setRevoking((current) => current && { ...current, open: false })}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revogar “{revoking?.integration.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O acesso é cortado na hora. Tokens já emitidos param de funcionar na próxima chamada. Para
                    reconectar o sistema, será preciso criar outra integração.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Manter integração</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => {
                      if (!revoking) return;
                      setRevoking({ ...revoking, open: false });
                      // Fase 11b: chamar revokeIntegrationClient.
                      const code = mockActionError("INTEGRATION_NOT_ACTIVE");
                      if (code) {
                        toast.error("Não foi possível revogar", { description: apiErrorMessage(code) });
                        return;
                      }
                      markRevoked(revoking.integration.id, new Date().toISOString());
                      toast.success("Integração revogada", { description: revoking.integration.name });
                    }}
                  >
                    Revogar integração
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      }}
    </PermissionCheck>
  );
}
