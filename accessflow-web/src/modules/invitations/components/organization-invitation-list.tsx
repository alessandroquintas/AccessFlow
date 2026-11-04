import { ClockAlertIcon, MailPlusIcon, MoreHorizontalIcon, XCircleIcon } from "lucide-react";
import { DataTable } from "@/shared/components/data-table";
import type { TableSkeletonColumn } from "@/shared/components/feedback/skeletons";
import { LocalDate } from "@/shared/components/local-date";
import { useNow } from "@/shared/hooks/use-now";
import { RoleBadge } from "@/shared/components/role-badge";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import type { OrganizationInvitation } from "../schemas";
import { InvitationStatusBadge } from "./invitation-status-badge";

/** As colunas da tabela, também usadas pelo skeleton. */
export const INVITATION_COLUMNS: TableSkeletonColumn[] = [
  { label: "E-mail" },
  { label: "Papel", cell: "badge", className: "w-36" },
  { label: "Convidado por", className: "w-40" },
  { label: "Expira em", className: "w-40" },
  { label: "Status", cell: "badge", className: "w-28" },
  { label: "Ações", hideLabel: true, cell: "action", className: "w-12 text-right" },
];

/** Menos de 2 dias para vencer: destaque. */
const SOON_MS = 2 * 24 * 60 * 60 * 1000;

/** labeled: na lista do celular, sem o cabeçalho da coluna, a data diz o que é. */
function Expiration({ invitation, labeled = false }: { invitation: OrganizationInvitation; labeled?: boolean }) {
  const now = useNow();

  if (invitation.status === "EXPIRED") {
    return (
      <span className="text-muted-foreground">
        Venceu <LocalDate iso={invitation.expiresAt} format="relative" />
      </span>
    );
  }
  if (invitation.status !== "PENDING") {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Não se aplica</span>
      </span>
    );
  }
  const soon = now !== null && new Date(invitation.expiresAt).getTime() - now < SOON_MS;
  return soon ? (
    <span className="flex items-center gap-1.5 font-medium text-warning">
      <ClockAlertIcon aria-hidden="true" className="size-4 shrink-0" />
      <span>
        Vence <LocalDate iso={invitation.expiresAt} format="relative" />
      </span>
    </span>
  ) : (
    <span className="tabular-nums">
      {labeled && <span className="text-muted-foreground">Expira em </span>}
      <LocalDate iso={invitation.expiresAt} format="datetime" />
    </span>
  );
}

export interface InvitationActionHandlers {
  onResend: (invitation: OrganizationInvitation) => void;
  onRevoke: (invitation: OrganizationInvitation) => void;
}

/** Reenviar renova o prazo (pendente ou vencido); revogar, só o pendente. */
function InvitationActions({ invitation, onResend, onRevoke }: { invitation: OrganizationInvitation } & InvitationActionHandlers) {
  const renewable = invitation.status === "PENDING" || invitation.status === "EXPIRED";
  if (!renewable) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Mais ações para o convite de ${invitation.email}`} />}
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onResend(invitation)}>
            <MailPlusIcon />
            Reenviar convite
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {invitation.status === "PENDING" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onClick={() => onRevoke(invitation)}>
                <XCircleIcon />
                Revogar convite
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Tabela do tablet para cima; no celular, linhas empilhadas (como em Membros). */
export function OrganizationInvitationList({
  invitations,
  ...handlers
}: { invitations: OrganizationInvitation[] } & InvitationActionHandlers) {
  return (
    <>
      <div className="hidden md:block">
        <DataTable>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {INVITATION_COLUMNS.map((column) => (
                <TableHead key={column.label} className={column.className}>
                  {column.hideLabel ? <span className="sr-only">{column.label}</span> : column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation) => (
              <TableRow key={invitation.id}>
                <TableCell className="font-medium">{invitation.email}</TableCell>
                <TableCell>
                  <RoleBadge {...invitation.assignedRole} />
                </TableCell>
                <TableCell className="text-muted-foreground">{invitation.invitedByName}</TableCell>
                <TableCell>
                  <Expiration invitation={invitation} />
                </TableCell>
                <TableCell>
                  <InvitationStatusBadge status={invitation.status} />
                </TableCell>
                <TableCell className="text-right">
                  <InvitationActions invitation={invitation} {...handlers} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      </div>

      <ul className="flex flex-col divide-y rounded-lg border px-3 py-3 md:hidden" aria-label="Convites">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
              <span className="truncate text-sm font-medium">{invitation.email}</span>
              <span className="flex flex-wrap items-center gap-2">
                <InvitationStatusBadge status={invitation.status} />
                <RoleBadge {...invitation.assignedRole} />
              </span>
              <span className="text-muted-foreground">Convidado por {invitation.invitedByName}</span>
              {(invitation.status === "PENDING" || invitation.status === "EXPIRED") && (
                <Expiration invitation={invitation} labeled />
              )}
            </div>
            <InvitationActions invitation={invitation} {...handlers} />
          </li>
        ))}
      </ul>
    </>
  );
}
