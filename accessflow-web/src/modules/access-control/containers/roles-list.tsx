"use client";

import { PlusIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { mockActionError, setScenario, useScenario } from "@/infra/mocks/scenario";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { LoadingRegion } from "@/shared/components/feedback/loading-region";
import { ListSkeleton, TableSkeleton } from "@/shared/components/feedback/skeletons";
import { Button } from "@/shared/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { apiErrorMessage } from "@/shared/lib/api-errors";
import { pluralize } from "@/shared/lib/format";
import { ConfirmDeleteDialog } from "../components/confirm-delete-dialog";
import { ROLE_COLUMNS, RoleList, type RoleRowState } from "../components/role-list";
import { useOrganizationRoles } from "../hooks/use-organization-roles";
import type { OrganizationRole } from "../schemas";

interface RolesProps {
  organizationId: string;
  viewerIsOwner: boolean;
}

/** Por que o papel não pode ser excluído: membros e convites pendentes, com os números. */
function deleteBlock(role: OrganizationRole) {
  const uses = [
    role.memberCount > 0 && pluralize(role.memberCount, "membro", "membros"),
    role.pendingInvitationCount > 0 &&
      pluralize(role.pendingInvitationCount, "convite pendente", "convites pendentes"),
  ].filter(Boolean);
  return uses.length > 0 ? `Usado por ${uses.join(" e ")}. Troque o papel antes de excluir.` : undefined;
}

/** "Criar papel" no cabeçalho: leva a /roles/new; no limite, desabilitado (o motivo fica na página). */
export function CreateRoleAction({ organizationId, viewerIsOwner }: RolesProps) {
  const { can, customRoleCount, customRoleLimit } = useOrganizationRoles(organizationId, viewerIsOwner);
  if (!can("roles:manage")) return null;

  const content = (
    <>
      <PlusIcon data-icon="inline-start" />
      <span className="sr-only sm:not-sr-only">Criar papel</span>
    </>
  );
  return customRoleCount >= customRoleLimit ? (
    <Button disabled aria-describedby="role-limit">
      {content}
    </Button>
  ) : (
    <Button render={<Link href="/roles/new" />} nativeButton={false}>
      {content}
    </Button>
  );
}

export function RolesList({ organizationId, viewerIsOwner }: RolesProps) {
  const pathname = usePathname();
  const scenario = useScenario();
  const { roles, can, customRoleCount, customRoleLimit, deleteRole } = useOrganizationRoles(organizationId, viewerIsOwner);
  const [target, setTarget] = useState<{ role: OrganizationRole; open: boolean } | null>(null);

  if (scenario === "loading") {
    return (
      <LoadingRegion label="Carregando papéis…" className="flex flex-col gap-4">
        <span aria-hidden="true" className="flex h-5 items-center">
          <Skeleton className="h-3.5 w-56" />
        </span>
        <TableSkeleton columns={ROLE_COLUMNS} rows={6} className="hidden md:block" />
        <ListSkeleton rows={5} icon={false} lines={3} trailing="action" className="rounded-lg border px-3 py-3 md:hidden" />
      </LoadingRegion>
    );
  }

  if (scenario === "error") return <ErrorState onRetry={() => setScenario("normal", pathname)} />;

  const canManage = can("roles:manage");
  // Cenário "Vazio": a organização só tem os papéis de sistema.
  const shown = scenario === "empty" ? roles.filter(({ kind }) => kind !== "CUSTOM") : roles;
  const customCount = scenario === "empty" ? 0 : customRoleCount;
  const atLimit = customCount >= customRoleLimit;

  const stateFor = (role: OrganizationRole): RoleRowState => ({
    editable: canManage && role.kind !== "OWNER",
    remove: canManage && role.kind === "CUSTOM" ? { blocked: deleteBlock(role) } : undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <p id="role-limit" className="text-sm text-muted-foreground" aria-live="polite">
        <span className="tabular-nums">
          {customCount} de {customRoleLimit}
        </span>{" "}
        papéis personalizados.
        {canManage && atLimit && " Limite atingido: exclua um papel sem uso para criar outro."}
      </p>

      <RoleList
        roles={shown}
        stateFor={stateFor}
        canSeeMembers={can("members:read")}
        onDelete={(role) => setTarget({ role, open: true })}
      />

      {customCount === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldCheckIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum papel personalizado</EmptyTitle>
            <EmptyDescription>
              Por enquanto há só o OWNER e o MEMBER. Crie um papel para agrupar as permissões de uma função.
            </EmptyDescription>
          </EmptyHeader>
          {canManage && (
            <EmptyContent>
              <Button render={<Link href="/roles/new" />} nativeButton={false}>
                <PlusIcon data-icon="inline-start" />
                Criar papel
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}

      <ConfirmDeleteDialog
        open={target?.open ?? false}
        title={`Excluir o papel ${target?.role.name ?? ""}?`}
        description="A exclusão é definitiva. O registro de auditoria guarda o que o papel concedia."
        confirmLabel="Excluir papel"
        cancelLabel="Manter papel"
        onOpenChange={(open) => !open && setTarget((current) => current && { ...current, open: false })}
        onConfirm={() => {
          if (!target) return;
          setTarget({ ...target, open: false });
          // Fase 11b: chamar deleteRole.
          const code = mockActionError("ROLE_IN_USE");
          if (code) {
            toast.error("Não foi possível excluir", { description: apiErrorMessage(code) });
            return;
          }
          deleteRole(target.role.id);
          toast.success("Papel excluído", { description: target.role.name });
        }}
      />
    </div>
  );
}
