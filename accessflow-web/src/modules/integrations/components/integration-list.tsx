import { MoreHorizontalIcon, XCircleIcon } from "lucide-react";
import { CopyButton } from "@/shared/components/copy-button";
import { DataTable } from "@/shared/components/data-table";
import type { TableSkeletonColumn } from "@/shared/components/feedback/skeletons";
import { LocalDate } from "@/shared/components/local-date";
import { ScopeTag } from "@/shared/components/scope-tag";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import type { Integration } from "../schemas";
import { IntegrationStatus } from "./integration-status";

/** As colunas da tabela, também usadas pelo skeleton. */
export const INTEGRATION_COLUMNS: TableSkeletonColumn[] = [
  { label: "Nome", className: "w-44" },
  { label: "client_id", className: "w-64" },
  { label: "Escopos" },
  { label: "Status", cell: "badge", className: "w-40" },
  { label: "Criada por", className: "w-44" },
  { label: "Ações", hideLabel: true, cell: "action", className: "w-12 text-right" },
];

interface IntegrationListProps {
  integrations: Integration[];
  /** Com integrations:manage: revogar as ativas. */
  canManage: boolean;
  onRevoke: (integration: Integration) => void;
}

function ClientId({ integration }: { integration: Integration }) {
  if (!integration.clientId) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Sem client_id</span>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-1">
      <code translate="no" className="truncate font-mono text-xs">{integration.clientId}</code>
      <CopyButton value={integration.clientId} label="client_id" size="icon-xs" />
    </span>
  );
}

function Scopes({ integration }: { integration: Integration }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {integration.scopes.map((scope) => (
        <ScopeTag key={scope} value={scope} />
      ))}
    </span>
  );
}

function CreatedBy({ integration }: { integration: Integration }) {
  return (
    <span className="flex flex-col text-xs">
      <span className="text-sm">{integration.createdBy?.name ?? "Antes do painel"}</span>
      <span className="text-muted-foreground">
        <LocalDate iso={integration.createdAt} />
      </span>
    </span>
  );
}

function Actions({ integration, canManage, onRevoke }: { integration: Integration } & Omit<IntegrationListProps, "integrations">) {
  // Só a ativa pode ser revogada; a que falhou nem chegou a existir.
  if (!canManage || integration.status !== "ACTIVE") return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Mais ações para a integração ${integration.name}`} />}
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={() => onRevoke(integration)}>
            <XCircleIcon />
            Revogar integração
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Tabela do tablet para cima; no celular, linhas empilhadas (como em Membros). */
export function IntegrationList({ integrations, ...props }: IntegrationListProps) {
  return (
    <>
      <div className="hidden md:block">
        <DataTable className="[&_td]:align-top [&_td]:whitespace-normal">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {INTEGRATION_COLUMNS.map((column) => (
                <TableHead key={column.label} className={column.className}>
                  {column.hideLabel ? <span className="sr-only">{column.label}</span> : column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {integrations.map((integration) => (
              <TableRow key={integration.id}>
                <TableCell className="font-medium">{integration.name}</TableCell>
                <TableCell>
                  <ClientId integration={integration} />
                </TableCell>
                <TableCell>
                  <Scopes integration={integration} />
                </TableCell>
                <TableCell>
                  <IntegrationStatus integration={integration} />
                </TableCell>
                <TableCell>
                  <CreatedBy integration={integration} />
                </TableCell>
                <TableCell className="text-right">
                  <Actions integration={integration} {...props} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      </div>

      <ul className="flex flex-col divide-y rounded-lg border px-3 py-3 md:hidden" aria-label="Integrações">
        {integrations.map((integration) => (
          <li key={integration.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
              <span className="font-medium">{integration.name}</span>
              <IntegrationStatus integration={integration} />
              <ClientId integration={integration} />
              <Scopes integration={integration} />
              <CreatedBy integration={integration} />
            </div>
            <Actions integration={integration} {...props} />
          </li>
        ))}
      </ul>
    </>
  );
}
