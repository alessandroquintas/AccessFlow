"use client";

import { KeyRoundIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { mockActionError, setScenario, useScenario } from "@/infra/mocks/scenario";
import { DataTable } from "@/shared/components/data-table";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { LoadingRegion } from "@/shared/components/feedback/loading-region";
import { TableSkeleton, type TableSkeletonColumn } from "@/shared/components/feedback/skeletons";
import { PermissionKeyTag } from "@/shared/components/permission-key-tag";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { apiErrorMessage } from "@/shared/lib/api-errors";
import { pluralize } from "@/shared/lib/format";
import { ConfirmDeleteDialog } from "../components/confirm-delete-dialog";
import { CreatePermissionDialog, EditPermissionDialog } from "../components/permission-dialogs";
import { useOrganizationCatalog } from "../hooks/use-organization-catalog";
import { useOrganizationRoles } from "../hooks/use-organization-roles";
import type { PermissionDefinition } from "../schemas";

const SYSTEM_COLUMNS: TableSkeletonColumn[] = [
  { label: "Chave", className: "w-1/3" },
  { label: "Descrição" },
];

const CUSTOM_COLUMNS: TableSkeletonColumn[] = [
  { label: "Chave", className: "w-1/3" },
  { label: "Descrição" },
  { label: "Usada por", className: "hidden w-32 sm:table-cell" },
  { label: "Ações", hideLabel: true, cell: "action", className: "w-12 text-right" },
];

function Header({ columns }: { columns: TableSkeletonColumn[] }) {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        {columns.map((column) => (
          <TableHead key={column.label} className={column.className}>
            {column.hideLabel ? <span className="sr-only">{column.label}</span> : column.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

function SectionTitle({ id, title, description }: { id: string; title: string; description: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 id={id} className="font-heading text-lg font-semibold">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

type DialogState =
  | { kind: "create"; open: boolean }
  | { kind: "edit" | "delete"; permission: PermissionDefinition; open: boolean }
  | null;

/** Permissões do sistema (só leitura) e as da organização (personalizadas). */
export function PermissionsCatalog({ organizationId, viewerIsOwner }: { organizationId: string; viewerIsOwner: boolean }) {
  const pathname = usePathname();
  const scenario = useScenario();
  const { system, custom, limits, createPermission, updateDescription, deletePermission } =
    useOrganizationCatalog(organizationId);
  const { can, rolesUsing } = useOrganizationRoles(organizationId, viewerIsOwner);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  if (scenario === "loading") {
    return (
      <LoadingRegion label="Carregando permissões…" className="flex flex-col gap-8">
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-5 w-48" />
          <TableSkeleton columns={SYSTEM_COLUMNS} rows={6} />
        </div>
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-5 w-56" />
          <TableSkeleton columns={CUSTOM_COLUMNS} rows={4} />
        </div>
      </LoadingRegion>
    );
  }

  if (scenario === "error") return <ErrorState onRetry={() => setScenario("normal", pathname)} />;

  const canManage = can("permissions:manage");
  const shownCustom = scenario === "empty" ? [] : custom;
  const atLimit = shownCustom.length >= limits.customPermissions;
  const open = (next: DialogState) => {
    setApiError(null);
    setDialog(next);
  };
  const close = () => setDialog((current) => current && { ...current, open: false });

  const createButton = canManage && (
    <Button onClick={() => open({ kind: "create", open: true })} disabled={atLimit} aria-describedby="permission-limit">
      <PlusIcon data-icon="inline-start" />
      Criar permissão
    </Button>
  );

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="system-permissions" className="flex flex-col gap-4">
        <SectionTitle
          id="system-permissions"
          title="Permissões do sistema"
          description="Existem em toda organização e não podem ser editadas nem excluídas."
        />
        <DataTable className="[&_td]:whitespace-normal">
          <Header columns={SYSTEM_COLUMNS} />
          <TableBody>
            {system.map((permission) => (
              <TableRow key={permission.key}>
                <TableCell>
                  <PermissionKeyTag value={permission.key} />
                </TableCell>
                <TableCell className="text-muted-foreground">{permission.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      </section>

      <section aria-labelledby="custom-permissions" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionTitle
            id="custom-permissions"
            title="Permissões da organização"
            description={
              <span id="permission-limit">
                <span className="tabular-nums">
                  {shownCustom.length} de {limits.customPermissions}
                </span>{" "}
                permissões personalizadas.
                {canManage && atLimit && " Limite atingido: exclua uma permissão sem uso para criar outra."}
              </span>
            }
          />
          {shownCustom.length > 0 && createButton}
        </div>

        {shownCustom.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <KeyRoundIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhuma permissão personalizada</EmptyTitle>
              <EmptyDescription>
                Crie permissões para as ações do seu negócio, como aprovar uma fatura, e consulte-as pelas integrações.
              </EmptyDescription>
            </EmptyHeader>
            {createButton && <EmptyContent>{createButton}</EmptyContent>}
          </Empty>
        ) : (
          <DataTable className="[&_td]:whitespace-normal">
            <Header columns={CUSTOM_COLUMNS} />
            <TableBody>
              {shownCustom.map((permission) => {
                const usedBy = rolesUsing(permission.key);
                const usage = usedBy > 0 ? `Concedida por ${pluralize(usedBy, "papel", "papéis")}` : "Nenhum papel";
                return (
                  <TableRow key={permission.key}>
                    <TableCell className="align-top sm:align-middle">
                      <PermissionKeyTag value={permission.key} />
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-col gap-0.5">
                        {permission.description}
                        <span className="text-xs text-muted-foreground sm:hidden">{usage}</span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                      {usedBy > 0 ? pluralize(usedBy, "papel", "papéis") : "Nenhum papel"}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon-sm" aria-label={`Mais ações para ${permission.key}`} />
                            }
                          >
                            <MoreHorizontalIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64">
                            <DropdownMenuGroup>
                              <DropdownMenuItem onClick={() => open({ kind: "edit", permission, open: true })}>
                                <PencilIcon />
                                Editar descrição
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                variant={usedBy > 0 ? "default" : "destructive"}
                                disabled={usedBy > 0}
                                onClick={() => open({ kind: "delete", permission, open: true })}
                                className="items-start data-disabled:text-muted-foreground data-disabled:opacity-100"
                              >
                                <Trash2Icon />
                                <span className="flex flex-col gap-0.5">
                                  Excluir permissão
                                  {usedBy > 0 && (
                                    <span className="text-xs">
                                      Concedida por {pluralize(usedBy, "papel", "papéis")}. Tire-a dos papéis antes.
                                    </span>
                                  )}
                                </span>
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
        )}
      </section>


      <CreatePermissionDialog
        open={dialog?.kind === "create" && dialog.open}
        onOpenChange={(next) => !next && close()}
        existingKeys={[...system, ...custom].map(({ key }) => key)}
        apiError={apiError}
        onSubmit={(values) => {
          // Fase 11b: chamar createPermission. Cada tentativa com o erro simulado mostra um código.
          const code = mockActionError(
            "PERMISSION_KEY_TAKEN",
            "PERMISSION_LIMIT_REACHED",
            "INVALID_PERMISSION_KEY",
            "RESERVED_PERMISSION_RESOURCE",
          );
          if (code) {
            setApiError(apiErrorMessage(code));
            return;
          }
          createPermission(values);
          close();
          toast.success("Permissão criada", { description: values.key });
        }}
      />
      <EditPermissionDialog
        open={dialog?.kind === "edit" && dialog.open}
        permission={dialog?.kind === "edit" ? dialog.permission : null}
        apiError={apiError}
        onOpenChange={(next) => !next && close()}
        onSubmit={({ description }) => {
          if (dialog?.kind !== "edit") return;
          // Fase 11b: chamar updatePermission.
          const code = mockActionError("ORGANIZATION_PERMISSION_DENIED");
          if (code) {
            setApiError(apiErrorMessage(code));
            return;
          }
          updateDescription(dialog.permission.key, description);
          close();
          toast.success("Descrição salva", { description: dialog.permission.key });
        }}
      />
      <ConfirmDeleteDialog
        open={dialog?.kind === "delete" && dialog.open}
        title={`Excluir a permissão ${dialog?.kind === "delete" ? dialog.permission.key : ""}?`}
        description="A exclusão é definitiva: a chave deixa de existir no catálogo da organização e não volta. Nenhum papel a concede hoje."
        confirmLabel="Excluir permissão"
        cancelLabel="Manter permissão"
        onOpenChange={(next) => !next && close()}
        onConfirm={() => {
          if (dialog?.kind !== "delete") return;
          close();
          // Fase 11b: chamar deletePermission.
          const code = mockActionError("PERMISSION_IN_USE");
          if (code) {
            toast.error("Não foi possível excluir", { description: apiErrorMessage(code) });
            return;
          }
          deletePermission(dialog.permission.key);
          toast.success("Permissão excluída", { description: dialog.permission.key });
        }}
      />
    </div>
  );
}
